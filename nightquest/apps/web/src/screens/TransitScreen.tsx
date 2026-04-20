import { Suspense, lazy, useMemo } from 'react';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { TypingText } from '../components/ui/TypingText';

type Coordinate = { lat: number; lng: number };

function parseRecommendedPath(value: string | null | undefined): Array<[number, number]> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<
      [number, number] | { lat?: number; lng?: number; latitude?: number; longitude?: number }
    >;
    return parsed
      .map((item) =>
        Array.isArray(item)
          ? ([Number(item[0]), Number(item[1])] as [number, number])
          : ([Number(item.lat ?? item.latitude), Number(item.lng ?? item.longitude)] as [number, number])
      )
      .filter((item) => Number.isFinite(item[0]) && Number.isFinite(item[1]));
  } catch {
    return [];
  }
}

const LazyTransitMap = lazy(async () => {
  const module = await import('../components/experience/TransitMap');
  return { default: module.TransitMap };
});
const LazyLostModeMap = lazy(async () => {
  const module = await import('../components/experience/LostModeMap');
  return { default: module.LostModeMap };
});

export function OmbraLineDisplay({ text }: { text: string }) {
  return <TypingText text={text} speed={32} className="mx-auto max-w-sm font-serif text-ombra-m italic text-ink-primary text-center" />;
}

export function DistanceLabel({ value }: { value: string }) {
  return <div className="font-serif text-ombra-s italic text-ink-secondary">{value}</div>;
}

export function TimerLabel({ value }: { value: string }) {
  return <div className="font-sans text-caption lowercase tracking-[0.1em] text-ink-tertiary">{value}</div>;
}

export function LostModeLink({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-end font-sans text-whisper uppercase text-ink-whisper transition-opacity duration-300 ease-base disabled:opacity-30"
    >
      sono perso
    </button>
  );
}

export function LostMap(props: {
  visible: boolean;
  destinationName: string;
  destination: Coordinate;
  userPosition: Coordinate | null;
  recommendedPath?: string | null;
  onClose: () => void;
  onConfirmArrival: () => void;
}) {
  const center = props.userPosition ?? props.destination;

  if (!props.visible) return null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-night-deep/95 p-6">
      <div className="mx-auto flex w-full max-w-shell flex-1 flex-col">
        <div className="mb-6">
          <TypingText
            text="Ti sei smarrito. Va bene, stanotte e concesso. Ma una sola volta."
            speed={32}
            className="font-serif text-ombra-s italic text-ink-primary"
          />
        </div>
        <Suspense
          fallback={
            <div className="relative flex-1 overflow-hidden rounded-xs border border-night-border bg-night-surface" />
          }
        >
          <LazyLostModeMap
            center={center}
            destination={props.destination}
            destinationName={props.destinationName}
            userPosition={props.userPosition}
            recommendedPath={props.recommendedPath}
          />
        </Suspense>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={props.onConfirmArrival}>Confermo di essere arrivato</Button>
          <Button variant="ghost" onClick={props.onClose}>
            Torna alla traccia
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TransitScreen(props: {
  destination: string;
  ombraLine: string;
  humanDistance: string;
  humanElapsed: string;
  userLat: number;
  userLng: number;
  userAccuracy?: number;
  destinationLat: number;
  destinationLng: number;
  recommendedPath?: string | null;
  batterySaverMode?: boolean;
  signalLost?: boolean;
  completed: number;
  total: number;
  lostModeDisabled?: boolean;
  onLostMode: () => void;
}) {
  const parsedRecommendedPath = useMemo(() => parseRecommendedPath(props.recommendedPath), [props.recommendedPath]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <ProgressBar total={props.total} completed={props.completed} />

      <div className="pt-2 text-center">
        <div className="font-sans text-whisper uppercase text-ink-tertiary">Diretto a</div>
        <div className="mt-2 font-serif text-body italic text-ink-secondary">{props.destination}</div>
      </div>

      <div className="space-y-6">
        <OmbraLineDisplay text={props.ombraLine} />
        <Suspense
          fallback={
            <div className="transit-map-shell relative h-[320px] overflow-hidden rounded-xs border border-night-border bg-night-surface/70">
              <div className="transit-map-vignette pointer-events-none absolute inset-0" />
            </div>
          }
        >
          <LazyTransitMap
            userLat={props.userLat}
            userLng={props.userLng}
            userAccuracy={props.userAccuracy}
            destinationLat={props.destinationLat}
            destinationLng={props.destinationLng}
            destinationName={props.destination}
            recommendedPath={parsedRecommendedPath}
            batterySaverMode={props.batterySaverMode}
            signalLost={props.signalLost}
          />
        </Suspense>
        <div className="space-y-2 text-center">
          <DistanceLabel value={props.humanDistance} />
          <TimerLabel value={props.humanElapsed} />
        </div>
      </div>

      <LostModeLink disabled={props.lostModeDisabled} onClick={props.onLostMode} />
    </section>
  );
}
