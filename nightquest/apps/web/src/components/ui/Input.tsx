import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  poeticPlaceholder?: boolean;
};

export function Input({ className, invalid, poeticPlaceholder, ...props }: Props) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xs border border-night-border bg-night-surface px-4 py-[14px] font-sans text-body text-ink-primary caret-ink-secondary transition-colors duration-300 ease-base placeholder:text-ink-whisper focus-visible:border-ink-tertiary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        poeticPlaceholder && 'placeholder:italic',
        invalid && 'border-accent-blood',
        className
      )}
    />
  );
}
