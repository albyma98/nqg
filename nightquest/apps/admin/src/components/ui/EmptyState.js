import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from './Button';
import { Card } from './Card';
export function EmptyState({ title, description, actionLabel, onAction }) {
    return (_jsxs(Card, { className: "flex flex-col items-start gap-4 p-6", children: [_jsx("svg", { width: "64", height: "40", viewBox: "0 0 64 40", "aria-hidden": "true", children: _jsx("path", { d: "M4 32h56M12 24l8-8 8 8 8-12 8 12 8-8", fill: "none", stroke: "#6a6a60", strokeWidth: "1.5" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-sans text-adminHeading font-semibold text-admin-text", children: title }), _jsx("p", { className: "mt-2 font-sans text-adminBody text-admin-muted", children: description })] }), actionLabel ? _jsx(Button, { onClick: onAction, children: actionLabel }) : null] }));
}
