import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'default' | 'success' | 'danger' | 'muted';

const toneClasses: Record<Tone, string> = {
  default: 'bg-admin-text text-white',
  success: 'bg-admin-success text-white',
  danger: 'bg-admin-danger text-white',
  muted: 'bg-admin-bg text-admin-muted border border-admin-border'
};

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const tone = (props as { tone?: Tone }).tone ?? 'default';
  return <span {...props} className={cn('inline-flex rounded-sm px-2 py-1 font-sans text-[12px] font-medium', toneClasses[tone], className)} />;
}
