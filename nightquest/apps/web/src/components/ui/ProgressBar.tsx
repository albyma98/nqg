import { cn } from '../../lib/cn';

type Props = {
  total: number;
  completed: number;
};

export function ProgressBar({ total, completed }: Props) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      className="flex gap-1"
    >
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-[2px] flex-1 rounded-pill',
            index < completed && 'bg-ink-tertiary',
            index === completed && 'bg-ink-whisper motion-safe:animate-breathe',
            index > completed && 'bg-night-border'
          )}
        />
      ))}
    </div>
  );
}
