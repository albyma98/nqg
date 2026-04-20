import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/cn';
const variantClasses = {
    primary: 'bg-admin-accent text-white hover:opacity-90',
    outline: 'border border-admin-border bg-white text-admin-text hover:bg-admin-bg',
    ghost: 'bg-transparent text-admin-muted hover:bg-admin-bg hover:text-admin-text',
    danger: 'bg-admin-danger text-white hover:opacity-90'
};
export function Button({ className, children, ...props }) {
    const variant = props.variant ?? 'primary';
    return (_jsx("button", { ...props, className: cn('inline-flex items-center justify-center rounded-sm px-4 py-3 font-sans text-adminBody font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-text disabled:cursor-not-allowed disabled:opacity-50', variantClasses[variant], className), children: children }));
}
