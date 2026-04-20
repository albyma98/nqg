import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/cn';
const toneClasses = {
    default: 'bg-admin-text text-white',
    success: 'bg-admin-success text-white',
    danger: 'bg-admin-danger text-white',
    muted: 'bg-admin-bg text-admin-muted border border-admin-border'
};
export function Badge({ className, ...props }) {
    const tone = props.tone ?? 'default';
    return _jsx("span", { ...props, className: cn('inline-flex rounded-sm px-2 py-1 font-sans text-[12px] font-medium', toneClasses[tone], className) });
}
