import { ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { getTransitState, haversineDistance, humanizeDistance } from '@nightquest/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type SessionState } from './api';
import { MissionCard } from './components/experience/MissionCard';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { TypingText } from './components/ui/TypingText';
import { useGeoTracker } from './lib/geoTracker';
import { PermissionFlow } from './screens/PermissionFlow';
import { LostMap, TransitScreen } from './screens/TransitScreen';
import { WalkBlindScreen } from './screens/WalkBlindScreen';

const STORAGE_KEY = 'nightquest.session.id';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function useTypingText(text: string) {
  const [visible, setVisible] = useState('');

  useEffect(() => {
    setVisible('');
    if (!text) return;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 28);

    return () => window.clearInterval(timer);
  }, [text]);

  return visible;
}

type Phase = 'loading' | 'city' | 'alias' | 'evocation' | 'permissions' | 'transit' | 'mission' | 'finale';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cities, setCities] = useState<Array<{ id: string; name: string; slug: string; openingLine: string }>>([]);
  const [selectedCityId, setSelectedCityId] = useState('');
  const [alias, setAlias] = useState('');
  const [session, setSession] = useState<SessionState | null>(null);
  const [ombraLine, setOmbraLine] = useState('');
  const [input, setInput] = useState('');
  const [hint, setHint] = useState('');
  const [errorFlash, setErrorFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState('');
  const [humanDistance, setHumanDistance] = useState('cammina ancora parecchio');
  const [humanElapsed, setHumanElapsed] = useState('siamo qui da poco');
  const [uncertainZone, setUncertainZone] = useState(false);
  const [batterySaver, setBatterySaver] = useState(false);
  const [lostMapVisible, setLostMapVisible] = useState(false);
  const [lostModeUsedForMission, setLostModeUsedForMission] = useState<Record<string, boolean>>({});
  const typedText = useTypingText(ombraLine);
  const transitionedMissionId = useRef<string | null>(null);

  function selectCity(cityId: string) {
    setSelectedCityId(cityId);
    window.setTimeout(() => setPhase('alias'), 0);
  }

  useGeoTracker({
    session,
    enabled: phase === 'transit' && Boolean(session?.geoPermissionGranted),
    batterySaver,
    onGeoResponse: (response) => {
      setHumanDistance(response.humanDistance);
      setHumanElapsed(response.timerSnapshot.humanElapsed);
      setUncertainZone(response.uncertainZone);
      if (response.ombraLine) {
        setOmbraLine(response.ombraLine);
      }
      setSession((current) => (current ? { ...current, geoState: response.geoState } : current));
      if (response.arrivalDetected) {
        setPhase('mission');
      }
    },
    onSample: (sample) => {
      const targetPlace = session?.currentMission?.place;
      if (targetPlace) {
        const distanceToTarget = Math.round(
          haversineDistance(sample.latitude, sample.longitude, targetPlace.latitude, targetPlace.longitude)
        );
        const localGeoState = getTransitState(
          {
            geoState: session.geoState,
            lastKnownLatitude: sample.latitude,
            lastKnownLongitude: sample.longitude
          },
          targetPlace
        );

        setHumanDistance(humanizeDistance(distanceToTarget));
        setUncertainZone(localGeoState === 'uncertain_zone');
      }

      setSession((current) =>
        current
          ? {
              ...current,
              lastKnownLatitude: sample.latitude,
              lastKnownLongitude: sample.longitude,
              lastKnownAccuracy: sample.accuracy,
              geoState: targetPlace
                ? getTransitState(
                    {
                      geoState: current.geoState,
                      lastKnownLatitude: sample.latitude,
                      lastKnownLongitude: sample.longitude
                    },
                    targetPlace
                  )
                : current.geoState
            }
          : current
      );
    },
    shouldSendImmediately: (sample) => {
      const targetPlace = session?.currentMission?.place;
      if (!targetPlace) return false;
      return haversineDistance(sample.latitude, sample.longitude, targetPlace.latitude, targetPlace.longitude) <= targetPlace.gpsRadius;
    },
    onError: (message) => {
      setNetworkError(message);
      setOmbraLine(message);
    }
  });

  useEffect(() => {
    void api.getCities().then((data) => {
      setCities(data);
      setSelectedCityId(data[0]?.id ?? '');
    });

    const savedSessionId = localStorage.getItem(STORAGE_KEY);
    if (!savedSessionId) {
      setPhase('city');
      return;
    }

    void api
      .getState(savedSessionId)
      .then(({ session: state, ombraLine: resumeLine, timerSnapshot }) => {
        setSession(state);
        setAlias(state.alias);
        setOmbraLine(resumeLine);
        setHumanElapsed(timerSnapshot.humanElapsed);
        setPhase(state.finishedAt ? 'finale' : state.geoState === 'at_place' ? 'mission' : 'transit');
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setNetworkError('La notte si interrompe. Torna quando puoi.');
        setPhase('city');
      });
  }, []);

  const completedMissionIds = useMemo(() => parseJson<string[]>(session?.completedMissionIds, []), [session]);
  const narrativeState = useMemo(() => parseJson<{ totalHints?: number; hesitations?: number }>(session?.narrativeState, {}), [session]);
  const checkpointOptions = useMemo(() => {
    const rule = parseJson<{ options?: string[] }>(session?.currentCheckpoint?.validationRule, {});
    return rule.options ?? [];
  }, [session]);

  useEffect(() => {
    if (!session?.currentMission || !session.currentMissionId) return;
    if (transitionedMissionId.current === session.currentMissionId) return;
    transitionedMissionId.current = session.currentMissionId;
    if (phase === 'mission') {
      void api.narrator(session.id, 'mission_intro').then((response) => setOmbraLine(response.ombraLine));
    }
  }, [phase, session]);

  useEffect(() => {
    if (!lostMapVisible) return;
    const timer = window.setTimeout(() => setLostMapVisible(false), 30000);
    return () => window.clearTimeout(timer);
  }, [lostMapVisible]);

  async function startSession() {
    if (!selectedCityId || !alias.trim()) return;
    setLoading(true);
    setNetworkError('');
    try {
      const created = await api.createSession({ cityId: selectedCityId, alias: alias.trim() });
      localStorage.setItem(STORAGE_KEY, created.session.id);
      setSession(created.session);
      setOmbraLine(created.ombraLine);
      setPhase('evocation');
    } catch {
      setNetworkError('La notte si interrompe. Torna quando puoi.');
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(value?: string | Record<string, unknown>) {
    if (!session?.currentCheckpoint) return;
    const payload = typeof value === 'undefined' ? input.trim() : value;
    if ((typeof payload === 'string' && !payload) || payload == null) return;

    setLoading(true);
    setNetworkError('');
    try {
      const response = await api.answer(session.id, {
        checkpointId: session.currentCheckpoint.id,
        input: payload
      });

      setSession(response.nextState);
      setOmbraLine(response.ombraLine);
      setInput('');
      setHint('');

      if (!response.valid) {
        window.navigator.vibrate?.(40);
        setErrorFlash(true);
        window.setTimeout(() => setErrorFlash(false), 600);
        return;
      }

      window.navigator.vibrate?.([80, 40, 80]);

      if (response.nextState.finishedAt) {
        setPhase('finale');
        return;
      }

      const movedToNextMission = response.nextState.currentMissionId !== session.currentMissionId;
      if (movedToNextMission) {
        setPhase('transit');
        setHumanDistance('cammina ancora parecchio');
        setLostMapVisible(false);
      }
    } catch {
      setNetworkError('La notte si interrompe. Torna quando puoi.');
      setOmbraLine('La notte si interrompe. Torna quando puoi.');
    } finally {
      setLoading(false);
    }
  }

  async function requestHint() {
    if (!session) return;
    setLoading(true);
    try {
      const response = await api.hint(session.id);
      setHint(response.hintText);
      setOmbraLine(response.ombraLine);
    } catch {
      setNetworkError('Qualcosa mi sta trattenendo. Aspetta.');
      setOmbraLine('Qualcosa mi sta trattenendo. Aspetta.');
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  async function handlePermissionComplete(result: {
    geoGranted: boolean;
    batteryLow: boolean;
    initialPosition?: { latitude: number; longitude: number; accuracy: number };
  }) {
    if (!session) return;
    setBatterySaver(result.batteryLow);
    await api.geoPermission(session.id, result.geoGranted);
    setSession({
      ...session,
      compassPermissionGranted: false,
      geoPermissionGranted: result.geoGranted,
      lastKnownLatitude: result.initialPosition?.latitude ?? session.lastKnownLatitude,
      lastKnownLongitude: result.initialPosition?.longitude ?? session.lastKnownLongitude,
      lastKnownAccuracy: result.initialPosition?.accuracy ?? session.lastKnownAccuracy
    });
    setPhase('transit');
    setOmbraLine(session.currentMission?.transit?.ambientLines.find((line) => line.trigger === 'start')?.text ?? ombraLine);
  }

  async function handleManualArrival(reason: 'manual' | 'fallback_uncertain' | 'lost_mode') {
    if (!session) return;
    const response = await api.arrive(session.id, reason);
    setHumanDistance(response.humanDistance);
    setHumanElapsed(response.timerSnapshot.humanElapsed);
    setOmbraLine(response.ombraLine ?? ombraLine);
    setPhase('mission');
    setLostMapVisible(false);
    setLostModeUsedForMission((current) => ({ ...current, [session.currentMissionId ?? 'unknown']: true }));
  }

  const currentValidationRule = useMemo(
    () =>
      parseJson<{
        durationSeconds?: number;
        requiredMinDistanceMeters?: number;
        options?: string[];
      }>(session?.currentCheckpoint?.validationRule, {}),
    [session]
  );

  return (
    <div className="min-h-[100dvh] bg-night-deep text-ink-primary">
      <LostMap
        visible={lostMapVisible}
        destinationName={session?.currentMission?.place.name ?? 'Destinazione'}
        destination={{
          lat: session?.currentMission?.place.latitude ?? 40.0562,
          lng: session?.currentMission?.place.longitude ?? 17.9925
        }}
        userPosition={
          session?.lastKnownLatitude != null && session?.lastKnownLongitude != null
            ? { lat: session.lastKnownLatitude, lng: session.lastKnownLongitude }
            : null
        }
        recommendedPath={session?.currentMission?.transit?.recommendedPath}
        onClose={() => setLostMapVisible(false)}
        onConfirmArrival={() => void handleManualArrival('lost_mode')}
      />
      <div className="safe-shell mx-auto flex min-h-[100dvh] max-w-shell flex-col px-5">
        <header className="mb-8 flex items-center justify-between">
          <div className="font-sans text-whisper uppercase text-ink-tertiary">NightQuest</div>
          {phase !== 'city' && phase !== 'loading' ? (
            <button
              onClick={resetSession}
              className="text-ink-tertiary transition-colors duration-300 ease-base hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary"
              aria-label="Ricomincia"
            >
              <RotateCcw size={15} />
            </button>
          ) : null}
        </header>

        {phase === 'loading' ? <div className="flex flex-1 items-center justify-center font-sans text-whisper uppercase text-ink-tertiary">Attesa</div> : null}

        {phase === 'city' ? (
          <section className="flex flex-1 flex-col justify-center gap-8">
            <div className="space-y-4 text-center">
              <div className="font-sans text-whisper uppercase text-ink-tertiary">Citta attive</div>
              <h1 className="font-serif text-display italic text-ink-primary">La notte sceglie il suo teatro.</h1>
              <p className="font-sans text-body text-ink-secondary">Per ora Gallipoli e l'unica soglia aperta.</p>
            </div>
            <div className="space-y-3">
              {cities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => selectCity(city.id)}
                  className="relative z-10 w-full cursor-pointer border border-night-border bg-night-surface/70 px-5 py-5 text-left transition-colors duration-600 ease-slow hover:border-ink-whisper hover:bg-night-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary"
                >
                  <div className="font-sans text-whisper uppercase text-ink-tertiary">{city.slug}</div>
                  <div className="mt-2 font-serif text-ombra-s italic text-ink-primary">{city.name}</div>
                  <div className="mt-3 font-sans text-body text-ink-secondary">{city.openingLine}</div>
                </button>
              ))}
            </div>
            {networkError ? <p className="font-serif text-ombra-s italic text-ink-secondary">{networkError}</p> : null}
          </section>
        ) : null}

        {phase === 'alias' ? (
          <section className="flex flex-1 flex-col justify-center gap-6">
            <div className="space-y-3 text-center">
              <div className="font-sans text-whisper uppercase text-ink-tertiary">Evocazione</div>
              <h2 className="font-serif text-ombra-l italic text-ink-primary">Prima volta? Bene. Scrivi un nome. Inventalo.</h2>
            </div>
            <Input value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={24} placeholder="Alias" className="text-center" poeticPlaceholder autoCapitalize="off" />
            <Button onClick={() => void startSession()} disabled={!alias.trim()} loading={loading}>
              Evoca L'Ombra
            </Button>
            {networkError ? <p className="font-serif text-ombra-s italic text-ink-secondary">{networkError}</p> : null}
          </section>
        ) : null}

        {phase === 'evocation' ? (
          <section className="flex flex-1 flex-col justify-center gap-10">
            <div className="space-y-4 text-center">
              <div className="font-sans text-whisper uppercase text-ink-tertiary">L'Ombra</div>
              <div className="min-h-32 rounded-xs border border-night-border bg-night-surface/40 p-6 shadow-glow">
                <TypingText text={ombraLine} speed={40} className="font-serif text-display italic text-ink-primary" />
              </div>
            </div>
            <Button onClick={() => setPhase('permissions')} disabled={typedText.length < ombraLine.length} variant="ghost" icon={<ChevronRight size={16} />}>
              Entra nella notte
            </Button>
          </section>
        ) : null}

        {phase === 'permissions' ? <PermissionFlow onComplete={(result) => void handlePermissionComplete(result)} /> : null}

        {phase === 'transit' && session?.currentMission ? (
          <TransitScreen
            destination={session.currentMission.place.name}
            ombraLine={ombraLine}
            humanDistance={humanDistance}
            humanElapsed={humanElapsed}
            userLat={session.lastKnownLatitude ?? session.currentMission.place.latitude}
            userLng={session.lastKnownLongitude ?? session.currentMission.place.longitude}
            userAccuracy={session.lastKnownAccuracy ?? undefined}
            destinationLat={session.currentMission.place.latitude}
            destinationLng={session.currentMission.place.longitude}
            recommendedPath={session.currentMission.transit?.recommendedPath}
            batterySaverMode={batterySaver}
            signalLost={session.geoState === 'lost_signal'}
            completed={completedMissionIds.length}
            total={5}
            lostModeDisabled={Boolean(lostModeUsedForMission[session.currentMission.id])}
            onLostMode={() => setLostMapVisible(true)}
          />
        ) : null}

        {phase === 'mission' && session?.currentMission && session.currentCheckpoint && session.currentCheckpoint.type === 'walk_blind' ? (
          <WalkBlindScreen
            ombraText={ombraLine}
            prompt={session.currentCheckpoint.prompt}
            durationSeconds={Number(currentValidationRule.durationSeconds ?? 180)}
            requiredMinDistanceMeters={Number(currentValidationRule.requiredMinDistanceMeters ?? 100)}
            loading={loading}
            onComplete={(payload) => void submitAnswer(payload)}
          />
        ) : null}

        {phase === 'mission' && session?.currentMission && session.currentCheckpoint && session.currentCheckpoint.type !== 'walk_blind' ? (
          <MissionCard
            zone={session.currentMission.place.zone}
            place={session.currentMission.place.name}
            ombraText={ombraLine}
            prompt={
              completedMissionIds.length === 0
                ? `${session.currentCheckpoint.prompt} Guarda il luogo. Rispondi sotto. Se non sai, chiedi — ma sappi che lo noterò.`
                : session.currentCheckpoint.prompt
            }
            completed={completedMissionIds.length}
            total={5}
            hint={hint}
            loading={loading}
            error={errorFlash}
          >
            <div className="space-y-3">
              {session.currentCheckpoint.type === 'multiple_choice' ? (
                checkpointOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => void submitAnswer(option)}
                    className="w-full border border-night-border bg-night-surface px-4 py-[14px] text-left font-sans text-body text-ink-secondary transition-all duration-300 ease-base hover:border-ink-whisper hover:bg-night-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary active:scale-[0.99]"
                  >
                    {option}
                  </button>
                ))
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void submitAnswer();
                    }}
                    className="flex-1"
                    placeholder="Scrivi..."
                    autoCapitalize="off"
                    inputMode="text"
                    invalid={errorFlash}
                    aria-invalid={errorFlash}
                  />
                  <Button onClick={() => void submitAnswer()} className="px-4" aria-label="Invia">
                    <ChevronRight size={18} />
                  </Button>
                </div>
              )}

              <Button onClick={() => void requestHint()} variant="whisper" icon={<Sparkles size={12} />} className={`mx-auto ${completedMissionIds.length === 0 ? 'opacity-50' : 'opacity-30'}`} aria-expanded={Boolean(hint)}>
                Chiedi un indizio
              </Button>

              {uncertainZone ? (
                <Button variant="ghost" onClick={() => void handleManualArrival('fallback_uncertain')}>
                  Confermo di essere arrivato
                </Button>
              ) : null}

              {networkError ? (
                <div className="space-y-3 pt-2">
                  <p className="font-serif text-ombra-s italic text-ink-secondary">{networkError}</p>
                  <Button variant="ghost" onClick={() => setNetworkError('')}>
                    Riprova
                  </Button>
                </div>
              ) : null}
            </div>
          </MissionCard>
        ) : null}

        {phase === 'finale' && session ? (
          <section className="flex flex-1 flex-col justify-center gap-8 text-center">
            <div className="space-y-4">
              <div className="font-sans text-whisper uppercase text-ink-tertiary">Epilogo</div>
              <TypingText text={ombraLine} speed={40} className="font-serif text-ombra-l italic text-ink-primary" />
            </div>
            <div className="space-y-1 font-sans text-caption text-ink-secondary">
              <div>{completedMissionIds.length} missioni attraversate</div>
              <div>{narrativeState.totalHints ?? 0} indizi richiesti</div>
              <div>{narrativeState.hesitations ?? 0} esitazioni</div>
              <div>{humanElapsed}</div>
            </div>
            <Button onClick={resetSession} variant="ghost">
              Un'altra notte
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
