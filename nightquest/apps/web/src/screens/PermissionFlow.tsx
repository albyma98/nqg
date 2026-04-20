import { useState } from 'react';
import { Button } from '../components/ui/Button';

type Props = {
  onComplete: (result: {
    geoGranted: boolean;
    batteryLow: boolean;
    initialPosition?: { latitude: number; longitude: number; accuracy: number };
  }) => void;
};

export function PermissionFlow({ onComplete }: Props) {
  const [step, setStep] = useState<'geo' | 'battery'>('geo');
  const [geoGranted, setGeoGranted] = useState(false);
  const [initialPosition, setInitialPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | undefined>();

  async function requestGeo() {
    if (!('geolocation' in navigator)) {
      setGeoGranted(false);
      setStep('battery');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoGranted(true);
        setInitialPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setStep('battery');
      },
      () => {
        setGeoGranted(false);
        setStep('battery');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
            setStep('battery');
          }}
        >
          Allora cammineremo diversamente
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
        <Button onClick={() => onComplete({ geoGranted, batteryLow: false, initialPosition })}>Comincia lo stesso</Button>
        <Button variant="ghost" onClick={() => onComplete({ geoGranted, batteryLow: true, initialPosition })}>
          Aspetto
        </Button>
      </div>
    </section>
  );
}
