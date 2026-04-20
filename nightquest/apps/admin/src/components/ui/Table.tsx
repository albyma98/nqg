import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Table({ children }: { children: ReactNode }) {
  return <table className="min-w-full text-left font-sans text-adminBody">{children}</table>;
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="text-admin-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-t border-admin-border', className)}>{children}</tr>;
}

export function TH({ children }: { children: ReactNode }) {
  return <th className="pb-3 pr-3 font-medium">{children}</th>;
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('py-3 pr-3 text-admin-text', className)}>{children}</td>;
}
