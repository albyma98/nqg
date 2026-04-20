import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/cn';
export function Card({ className, ...props }) {
    return _jsx("div", { ...props, className: cn('rounded-md border border-admin-border bg-admin-surface p-4', className) });
}
