'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
export default function GlobalError({ error, reset, }) {
    useEffect(() => {
        // Error will be captured by browser SDK if initialized
        console.error('Global error:', error);
    }, [error]);
    return (_jsx("html", { children: _jsx("body", { children: _jsxs("div", { style: { padding: '2rem', maxWidth: '600px', margin: '0 auto' }, children: [_jsx("h2", { children: "Something went wrong!" }), _jsx("p", { style: { color: '#666' }, children: "An unexpected error occurred. Our team has been notified." }), _jsx("button", { onClick: () => reset(), style: {
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: '#0070f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }, children: "Try again" })] }) }) }));
}
//# sourceMappingURL=global-error.js.map