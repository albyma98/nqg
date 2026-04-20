import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/cn';
export function ProgressBar({ total, completed }) {
    return (_jsx("div", { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": completed, className: "flex gap-1", children: Array.from({ length: total }).map((_, index) => (_jsx("div", { className: cn('h-[2px] flex-1 rounded-pill', index < completed && 'bg-ink-tertiary', index === completed && 'bg-ink-whisper motion-safe:animate-breathe', index > completed && 'bg-night-border') }, index))) }));
}
