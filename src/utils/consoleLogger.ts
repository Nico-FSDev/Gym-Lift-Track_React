import { logErrorToFirebase, getActiveSessionId } from './sessionManager';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'error' | 'warn' | 'exception' | 'rejection' | 'audit_failure' | 'bug_report';
  source?: 'runtime' | 'console' | 'audit_app' | 'bug_report' | 'exception' | 'rejection';
  message: string;
  stack?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

type LogListener = (logs: LogEntry[]) => void;

let logs: LogEntry[] = [];
const listeners = new Set<LogListener>();

export const consoleLogger = {
  getLogs(): LogEntry[] {
    return [...logs];
  },

  clearLogs() {
    logs = [];
    this.notify();
  },

  subscribe(listener: LogListener) {
    listeners.add(listener);
    // Call immediately with current logs
    listener([...logs]);
    return () => {
      listeners.delete(listener);
    };
  },

  notify() {
    listeners.forEach((listener) => {
      try {
        listener([...logs]);
      } catch (err) {
        // Prevent infinite render loops or listener issues from crashing the logging loop
        console.warn('Error in console logger listener:', err);
      }
    });
  },

  addLog(
    type: LogEntry['type'],
    message: string,
    stack?: string,
    source: LogEntry['source'] = 'runtime',
    metadata?: Record<string, any>
  ) {
    const activeSessionId = getActiveSessionId();
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      type,
      source,
      message,
      stack,
      sessionId: activeSessionId,
      metadata,
    };
    logs.push(entry);
    // Keep a maximum of 300 logs to avoid excessive memory footprint
    if (logs.length > 300) {
      logs.shift();
    }
    this.notify();

    // Async register in Firebase error console collection for session (with 7 days TTL)
    if (type !== 'warn') {
      logErrorToFirebase({
        type,
        source: source || 'runtime',
        message,
        stack,
        metadata,
        sessionId: activeSessionId,
      }).catch(() => {});
    }
  },

  addAuditError(partName: string, errorMessage: string, details?: string) {
    this.addLog('audit_failure', `[AUDIT: ${partName}] ${errorMessage}`, details, 'audit_app', {
      part: partName,
    });
  },

  addBugReportError(reportTitle: string, errorMessage: string, details?: string) {
    this.addLog('bug_report', `[BUG REPORT: ${reportTitle}] ${errorMessage}`, details, 'bug_report', {
      title: reportTitle,
    });
  },
};

export function initConsoleLogger() {
  if (typeof window === 'undefined') return;

  // Prevent multiple initializations
  if ((window as any).__CONSOLE_LOGGER_INITIALIZED__) return;
  (window as any).__CONSOLE_LOGGER_INITIALIZED__ = true;

  // Intercept console.error
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    // Invoke the original console.error so they still appear in DevTools
    originalConsoleError.apply(console, args);

    const message = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    const errorArg = args.find((arg) => arg instanceof Error);
    const stack = errorArg ? errorArg.stack : new Error().stack;

    consoleLogger.addLog('error', message, stack, 'console');
  };

  // Intercept general script errors and assets loading errors
  window.addEventListener('error', (event) => {
    // Ignore cross-origin script error messages that are unhelpful
    if (event.message === 'Script error.' && !event.filename) return;

    const message = event.message || 'Uncaught runtime exception';
    const stack = event.error ? event.error.stack : `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`;
    consoleLogger.addLog('exception', message, stack, 'exception');
  }, true); // Use capture phase to catch resource loading failures as well

  // Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack: string | undefined;

    if (reason) {
      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'object') {
        try {
          message = JSON.stringify(reason);
        } catch {
          message = String(reason);
        }
      } else {
        message = String(reason);
      }
    }

    consoleLogger.addLog('rejection', message, stack, 'rejection');
  });
}
