import type { ReactNode } from 'react';
import { ProgressBar } from '../ui/ProgressBar';
import { TypingText } from '../ui/TypingText';

type Props = {
  zone: string;
  place: string;
  ombraText: string;
  prompt: string;
  completed: number;
  total: number;
  children: ReactNode;
  hint?: string;
  loading?: boolean;
  error?: boolean;
};

export function MissionCard({ zone, place, ombraText, prompt, completed, total, children, hint, loading, error }: Props) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <ProgressBar total={total} completed={completed} />
      <div className="space-y-2">
        <div className="font-sans text-whisper uppercase text-ink-tertiary">{zone}</div>
        <div className="font-sans text-caption text-ink-secondary">{place}</div>
      </div>

      <div
        aria-live="polite"
        className={`min-h-[9rem] border-l-2 bg-night-surface/50 px-5 py-5 ${error ? 'border-accent-blood' : 'border-night-border'}`}
      >
        <div className="mb-2 font-sans text-whisper uppercase text-ink-tertiary motion-safe:animate-whisper">L'Ombra sussurra</div>
        <TypingText text={ombraText} loading={loading} className="font-serif text-ombra-m italic text-ink-primary" />
      </div>

      <div className="space-y-2">
        <div className="font-sans text-whisper uppercase text-ink-tertiary">Il compito</div>
        <p className="font-sans text-body text-ink-secondary">{prompt}</p>
      </div>

      {hint ? (
        <div aria-live="polite" className="border border-night-border bg-night-surface px-4 py-4">
          <div className="mb-1 font-sans text-whisper uppercase text-ink-tertiary">Indizio</div>
          <p className="font-sans text-caption text-ink-secondary">{hint}</p>
        </div>
      ) : null}

      <div className="mt-auto">{children}</div>
    </section>
  );
}
