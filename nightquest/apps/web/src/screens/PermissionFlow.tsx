import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { acquireInitialPosition } from '../lib/geoFilters';
import { compassPermissionRequiresPrompt, requestCompassPermission } from '../lib/geoTracker';
import { isSpeechAvailable, setVoiceEnabled, speak, warmupVoices } from '../lib/speech';
import { shouldEnableBatterySaver, useBatteryStatus } from '../lib/battery';

type Props = {
  onComplete: (result: {
    geoGranted: boolean;
    compassGranted: boolean;
    voiceEnabled: boolean;
    batteryLow: boolean;
    initialPosition?: { latitude: number; longitude: number; accuracy: number };
  }) => void;
};

type Step = 'geo' | 'acquiring' | 'compass' | 'voice' | 'battery';

export function PermissionFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('geo');
  const [geoGranted, setGeoGranted] = useState(false);
  const [compassGranted, setCompassGranted] = useState(false);
  const [voiceEnabled, setVoiceEnabledState] = useState(false);
  const [initialPosition, setInitialPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | undefined>();
  const battery = useBatteryStatus();

  useEffect(() => {
    warmupVoices();
  }, []);

  const advanceAfterGeo = () => {
    if (compassPermissionRequiresPrompt()) {
      setStep('compass');
    } else if (isSpeechAvailable()) {
      setStep('voice');
    } else {
      finalize({});
    }
  };

  function finalize(overrides: { voiceEnabledOverride?: boolean; compassGrantedOverride?: boolean }) {
    const auto = shouldEnableBatterySaver(battery);
    if (auto != null) {
      onComplete({
        geoGranted,
        compassGranted: overrides.compassGrantedOverride ?? compassGranted,
        voiceEnabled: overrides.voiceEnabledOverride ?? voiceEnabled,
        batteryLow: auto,
        initialPosition
      });
      return;
    }
    setStep('battery');
  }

  async function requestGeo() {
    if (!('geolocation' in navigator)) {
      setGeoGranted(false);
      advanceAfterGeo();
      return;
    }

    setStep('acquiring');
    const result = await acquireInitialPosition({ targetAccuracyMeters: 25, maxWaitMs: 8000 });
    if (result.best) {
      setGeoGranted(true);
      setInitialPosition({
        latitude: result.best.latitude,
        longitude: result.best.longitude,
        accuracy: result.best.accuracy
      });
    } else {
      setGeoGranted(false);
    }
    advanceAfterGeo();
  }

  async function requestCompass() {
    const granted = await requestCompassPermission();
    setCompassGranted(granted);
    if (isSpeechAvailable()) {
      setStep('voice');
    } else {
      finalize({ compassGrantedOverride: granted });
    }
  }

  function chooseVoice(enabled: boolean) {
    setVoiceEnabledState(enabled);
    setVoiceEnabled(enabled);
    if (enabled) {
      speak('Ti accompagno con la voce.');
    }
    finalize({ voiceEnabledOverride: enabled });
  }

  if (step === 'geo') {
    return (
      <section className="flex flex-1 flex-col justify-center gap-6 text-center">
        <p className="font-serif text-ombra-l italic text-ink-primary">
          Per sentirti camminare, devo sapere dove sei. Non e sorveglianza. E presenza.
        </p>
        <Button onClick={() => void requestGeo()}>Lo concedo</Button>
        <Button
          variant="ghost"
          onClick={() => {
            setGeoGranted(false);
            advanceAfterGeo();
          }}
        >
          Allora cammineremo diversamente
        </Button>
      </section>
    );
  }

  if (step === 'acquiring') {
    return (
      <section className="flex flex-1 flex-col justify-center gap-6 text-center">
        <p className="font-serif text-ombra-l italic text-ink-primary">Ti sto trovando…</p>
        <p className="font-sans text-caption text-ink-tertiary">Resta fermo qualche secondo, il cielo ti riconosce.</p>
      </section>
    );
  }

  if (step === 'compass') {
    return (
      <section className="flex flex-1 flex-col justify-center gap-6 text-center">
        <p className="font-serif text-ombra-l italic text-ink-primary">Lasciami sentire dove guardi.</p>
        <p className="font-sans text-caption text-ink-tertiary">La bussola mi dice da che parte ti volti.</p>
        <Button onClick={() => void requestCompass()}>Lo concedo</Button>
        <Button
          variant="ghost"
          onClick={() => {
            setCompassGranted(false);
            if (isSpeechAvailable()) {
              setStep('voice');
            } else {
              finalize({ compassGrantedOverride: false });
            }
          }}
        >
          Cammineremo senza bussola
        </Button>
      </section>
    );
  }

  if (step === 'voice') {
    return (
      <section className="flex flex-1 flex-col justify-center gap-6 text-center">
        <p className="font-serif text-ombra-l italic text-ink-primary">Vuoi che ti parli?</p>
        <p className="font-sans text-caption text-ink-tertiary">
          Cosi puoi camminare a testa alta. Lo schermo resta solo per le risposte.
        </p>
        <Button onClick={() => chooseVoice(true)}>Si, parlami</Button>
        <Button variant="ghost" onClick={() => chooseVoice(false)}>
          Preferisco leggere
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col justify-center gap-6 text-center">
      <p className="font-serif text-ombra-l italic text-ink-primary">
        Il tuo telefono e gia stanco. Sicuro di voler cominciare?
      </p>
      <div className="flex flex-col gap-3">
        <Button
          onClick={() =>
            onComplete({
              geoGranted,
              compassGranted,
              voiceEnabled,
              batteryLow: false,
              initialPosition
            })
          }
        >
          Comincia lo stesso
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            onComplete({
              geoGranted,
              compassGranted,
              voiceEnabled,
              batteryLow: true,
              initialPosition
            })
          }
        >
          Aspetto
        </Button>
      </div>
    </section>
  );
}
