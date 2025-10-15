/**
 * Browser-side Error Capture SDK for Next.js
 * Captures unhandled errors and sends them to Lattice API
 */
'use client';
import { parse } from 'error-stack-parser-es';
import { BreadcrumbCategory, BreadcrumbLevel } from '@lattice.black/core';
let config = null;
let sessionId = null;
let breadcrumbs = [];
const MAX_BREADCRUMBS_DEFAULT = 100;
/**
 * Initialize Lattice monitoring
 */
export function initLatticeMonitoring(userConfig) {
    config = {
        ...userConfig,
        environment: userConfig.environment || process.env.NODE_ENV || 'development',
        captureUnhandledErrors: userConfig.captureUnhandledErrors !== false,
        captureUnhandledRejections: userConfig.captureUnhandledRejections !== false,
        captureBreadcrumbs: userConfig.captureBreadcrumbs !== false,
        captureConsole: userConfig.captureConsole !== false,
        captureNavigation: userConfig.captureNavigation !== false,
        captureClicks: userConfig.captureClicks !== false,
        maxBreadcrumbs: userConfig.maxBreadcrumbs || MAX_BREADCRUMBS_DEFAULT,
        enabled: userConfig.enabled !== false,
    };
    if (!config.enabled) {
        return;
    }
    // Generate or restore session ID
    sessionId = getOrCreateSessionId();
    // Initialize breadcrumbs
    if (config.captureBreadcrumbs) {
        setupBreadcrumbCapture();
    }
    // Capture unhandled errors
    if (config.captureUnhandledErrors) {
        window.addEventListener('error', handleGlobalError);
    }
    // Capture unhandled promise rejections
    if (config.captureUnhandledRejections) {
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }
    console.log(`[Lattice] Monitoring initialized for ${config.serviceName}`);
}
/**
 * Manually capture an error
 */
export function captureError(error, context) {
    if (!config || !config.enabled) {
        return;
    }
    // Add error breadcrumb
    addBreadcrumb(BreadcrumbCategory.Custom, error.message, BreadcrumbLevel.Error, {
        name: error.name,
        errorType: 'error',
        ...context,
    });
    const stackFrames = parseStackTrace(error);
    const errorEvent = {
        service_id: config.serviceName,
        environment: config.environment,
        error_type: error.name || 'Error',
        message: error.message || 'Unknown error',
        stack_trace: stackFrames,
        context,
        session_id: sessionId || undefined,
        timestamp: new Date(),
    };
    // Send error with breadcrumbs
    Promise.all([
        sendToAPI(errorEvent),
        sendBreadcrumbs(getBreadcrumbs()),
    ]).catch(err => {
        console.error('[Lattice] Failed to send error:', err);
    });
}
/**
 * Handle window.onerror events
 */
function handleGlobalError(event) {
    if (!config)
        return;
    const error = event.error || new Error(event.message);
    captureError(error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'unhandled_error',
    });
}
/**
 * Handle unhandledrejection events
 */
function handleUnhandledRejection(event) {
    if (!config)
        return;
    const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    captureError(error, {
        type: 'unhandled_rejection',
        reason: event.reason,
    });
}
/**
 * Parse error stack trace
 */
function parseStackTrace(error) {
    try {
        const frames = parse(error);
        return frames.map(frame => ({
            filename: frame.fileName || 'unknown',
            line_number: frame.lineNumber || 0,
            column_number: frame.columnNumber,
            function_name: frame.functionName || '<anonymous>',
        }));
    }
    catch (err) {
        return [{
                filename: 'unknown',
                line_number: 0,
                function_name: error.name || 'Error',
            }];
    }
}
/**
 * Send error event to Lattice API
 */
async function sendToAPI(errorEvent) {
    if (!config)
        return;
    try {
        const response = await fetch(`${config.apiEndpoint}/errors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Lattice-API-Key': config.apiKey,
            },
            body: JSON.stringify(errorEvent),
        });
        if (!response.ok) {
            console.error(`[Lattice] Failed to send error: ${response.status} ${response.statusText}`);
        }
    }
    catch (err) {
        // Fail silently to avoid error loops
        console.error('[Lattice] Network error:', err);
    }
}
/**
 * Get or create session ID
 */
function getOrCreateSessionId() {
    if (typeof window === 'undefined') {
        return '';
    }
    try {
        let id = sessionStorage.getItem('lattice_session_id');
        if (!id) {
            // Generate ULID-like ID (timestamp + random)
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 15);
            id = `${timestamp}-${random}`;
            sessionStorage.setItem('lattice_session_id', id);
        }
        return id;
    }
    catch (err) {
        // SessionStorage might not be available
        return `temp-${Date.now()}`;
    }
}
/**
 * Manually add a breadcrumb
 */
export function addBreadcrumb(category, message, level = BreadcrumbLevel.Info, data) {
    if (!config || !config.enabled || !config.captureBreadcrumbs) {
        return;
    }
    const breadcrumb = {
        session_id: sessionId || '',
        category,
        message,
        level,
        data,
        timestamp: new Date(),
    };
    breadcrumbs.push(breadcrumb);
    // Keep only last N breadcrumbs
    const maxBreadcrumbs = config.maxBreadcrumbs || MAX_BREADCRUMBS_DEFAULT;
    if (breadcrumbs.length > maxBreadcrumbs) {
        breadcrumbs.shift();
    }
}
/**
 * Get current breadcrumbs
 */
export function getBreadcrumbs() {
    return [...breadcrumbs];
}
/**
 * Clear breadcrumbs
 */
export function clearBreadcrumbs() {
    breadcrumbs = [];
}
/**
 * Setup automatic breadcrumb capture
 */
function setupBreadcrumbCapture() {
    if (!config)
        return;
    // Capture console logs
    if (config.captureConsole) {
        instrumentConsole();
    }
    // Capture navigation
    if (config.captureNavigation) {
        instrumentNavigation();
    }
    // Capture clicks
    if (config.captureClicks) {
        instrumentClicks();
    }
}
/**
 * Instrument console methods
 */
function instrumentConsole() {
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
    };
    console.log = (...args) => {
        addBreadcrumb(BreadcrumbCategory.Console, args.join(' '), BreadcrumbLevel.Info);
        originalConsole.log(...args);
    };
    console.warn = (...args) => {
        addBreadcrumb(BreadcrumbCategory.Console, args.join(' '), BreadcrumbLevel.Warning);
        originalConsole.warn(...args);
    };
    console.error = (...args) => {
        addBreadcrumb(BreadcrumbCategory.Console, args.join(' '), BreadcrumbLevel.Error);
        originalConsole.error(...args);
    };
    console.info = (...args) => {
        addBreadcrumb(BreadcrumbCategory.Console, args.join(' '), BreadcrumbLevel.Info);
        originalConsole.info(...args);
    };
}
/**
 * Instrument navigation events
 */
function instrumentNavigation() {
    // Capture page loads
    addBreadcrumb(BreadcrumbCategory.Navigation, `Page loaded: ${window.location.href}`, BreadcrumbLevel.Info);
    // Capture history changes (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function (...args) {
        addBreadcrumb(BreadcrumbCategory.Navigation, `Navigated to: ${args[2] || window.location.href}`, BreadcrumbLevel.Info);
        return originalPushState.apply(this, args);
    };
    history.replaceState = function (...args) {
        addBreadcrumb(BreadcrumbCategory.Navigation, `Replaced state: ${args[2] || window.location.href}`, BreadcrumbLevel.Info);
        return originalReplaceState.apply(this, args);
    };
    // Capture popstate (back/forward)
    window.addEventListener('popstate', () => {
        addBreadcrumb(BreadcrumbCategory.Navigation, `Back/Forward to: ${window.location.href}`, BreadcrumbLevel.Info);
    });
}
/**
 * Instrument click events
 */
function instrumentClicks() {
    document.addEventListener('click', (event) => {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        let message = `Clicked ${tagName}`;
        // Add more context for specific elements
        if (tagName === 'button') {
            message += target.textContent ? `: ${target.textContent.trim().substring(0, 50)}` : '';
        }
        else if (tagName === 'a') {
            const href = target.href;
            message += href ? `: ${href}` : '';
        }
        else if (target.id) {
            message += `#${target.id}`;
        }
        else if (target.className) {
            message += `.${target.className.split(' ')[0]}`;
        }
        addBreadcrumb(BreadcrumbCategory.UserAction, message, BreadcrumbLevel.Info, {
            tagName,
            id: target.id || undefined,
            className: target.className || undefined,
        });
    }, true); // Use capture phase
}
/**
 * Send breadcrumbs to API
 */
async function sendBreadcrumbs(breadcrumbsToSend) {
    if (!config || breadcrumbsToSend.length === 0)
        return;
    try {
        const response = await fetch(`${config.apiEndpoint}/breadcrumbs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Lattice-API-Key': config.apiKey,
            },
            body: JSON.stringify({ breadcrumbs: breadcrumbsToSend }),
        });
        if (!response.ok) {
            console.error(`[Lattice] Failed to send breadcrumbs: ${response.status} ${response.statusText}`);
        }
    }
    catch (err) {
        // Fail silently
        console.error('[Lattice] Network error sending breadcrumbs:', err);
    }
}
//# sourceMappingURL=browser-sdk.js.map