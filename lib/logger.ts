// ── Structured Logger — Production-ready logging ────────────────────────────
// Replaces console.log/error/warn with structured JSON logging
// Compatible with Vercel Logs, Sentry, and any log aggregator

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }
  if (context && Object.keys(context).length > 0) entry.context = context
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return entry
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog(createLogEntry('debug', message, context)))
    }
  },
  info(message: string, context?: LogContext) {
    console.log(formatLog(createLogEntry('info', message, context)))
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLog(createLogEntry('warn', message, context)))
  },
  error(message: string, context?: LogContext, error?: Error) {
    console.error(formatLog(createLogEntry('error', message, context, error)))
  },
  fatal(message: string, context?: LogContext, error?: Error) {
    console.error(formatLog(createLogEntry('fatal', message, context, error)))
  },
  // Helper for API route logging
  api(route: string, method: string, statusCode: number, durationMs: number, context?: LogContext) {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    const entry = formatLog(createLogEntry(level, `${method} ${route} ${statusCode} ${durationMs}ms`, {
      route,
      method,
      statusCode,
      durationMs,
      ...context,
    }))
    if (level === 'error') {
      console.error(entry)
    } else if (level === 'warn') {
      console.warn(entry)
    } else {
      console.log(entry)
    }
  },
}
