import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/cn';
export function Table({ children }) {
    return _jsx("table", { className: "min-w-full text-left font-sans text-adminBody", children: children });
}
export function THead({ children }) {
    return _jsx("thead", { className: "text-admin-muted", children: children });
}
export function TBody({ children }) {
    return _jsx("tbody", { children: children });
}
export function TR({ children, className }) {
    return _jsx("tr", { className: cn('border-t border-admin-border', className), children: children });
}
export function TH({ children }) {
    return _jsx("th", { className: "pb-3 pr-3 font-medium", children: children });
}
export function TD({ children, className }) {
    return _jsx("td", { className: cn('py-3 pr-3 text-admin-text', className), children: children });
}
