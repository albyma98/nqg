import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'ghost' | 'whisper';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ink-primary text-night-deep hover:bg-white disabled:bg-night-border disabled:text-ink-whisper px-6 py-[14px] font-sans text-caption font-medium uppercase tracking-[0.2em]',
  ghost:
    'border border-night-border bg-transparent text-ink-secondary hover:border-ink-whisper hover:bg-night-surface px-6 py-[14px] font-sans text-caption font-medium uppercase tracking-[0.2em]',
  whisper:
    'bg-transparent px-2 py-2 font-sans text-whisper uppercase tracking-[0.3em] text-ink-tertiary hover:text-ink-secondary'
};

export function Button({ className, variant = 'primary', loading, disabled, children, icon, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xs transition-transform duration-150 ease-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-tertiary active:scale-[0.98] disabled:cursor-not-allowed',
        variantClasses[variant],
        className
      )}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle size={variant === 'whisper' ? 12 : 16} className="animate-spin" />
          <span aria-hidden="true">...</span>
        </span>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
