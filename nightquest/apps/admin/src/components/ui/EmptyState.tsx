import { Button } from './Button';
import { Card } from './Card';

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
        <path d="M4 32h56M12 24l8-8 8 8 8-12 8 12 8-8" fill="none" stroke="#6a6a60" strokeWidth="1.5" />
      </svg>
      <div>
        <div className="font-sans text-adminHeading font-semibold text-admin-text">{title}</div>
        <p className="mt-2 font-sans text-adminBody text-admin-muted">{description}</p>
      </div>
      {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </Card>
  );
}
