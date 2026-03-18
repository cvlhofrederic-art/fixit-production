// ── Pagination helper for API routes ─────────────────────────────────────────
export function parsePagination(url: URL, defaults = { page: 1, perPage: 100, maxPerPage: 500 }) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || String(defaults.page)) || defaults.page)
  const perPage = Math.min(defaults.maxPerPage, Math.max(1, parseInt(url.searchParams.get('per_page') || String(defaults.perPage)) || defaults.perPage))
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return { page, perPage, from, to }
}

// ── Structured Logger — Production-ready logging ────────────────────────────
// Replaces console.log/error/warn with structured JSON logging
// Compatible with Vercel Logs, Sentry, and any log aggregator
import * as Sentry from '@sentry/nextjs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

// Coerce any value to LogContext (console.log accepted anything)
function toContext(val: unknown): LogContext | undefined {
  if (!val) return undefined
  if (val instanceof Error) return { error: val.message, stack: val.stack }
  if (typeof val === 'object' && val !== null) {
    try { return { ...val } as LogContext } catch { return { value: String(val) } }
  }
  return { value: val }
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
  debug(message: string, context?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog(createLogEntry('debug', message, toContext(context))))
    }
  },
  info(message: string, context?: unknown) {
    console.log(formatLog(createLogEntry('info', message, toContext(context))))
  },
  warn(message: string, context?: unknown) {
    console.warn(formatLog(createLogEntry('warn', message, toContext(context))))
  },
  error(message: string, context?: unknown, err?: unknown) {
    const ctx = toContext(context)
    const errObj = err instanceof Error ? err : err ? new Error(String(err)) : undefined
    console.error(formatLog(createLogEntry('error', message, ctx, errObj)))
    // Send to Sentry for production error tracking
    if (errObj) {
      Sentry.withScope((scope) => {
        if (ctx) {
          const { userId, tenantId, module: mod, ...extras } = ctx as Record<string, unknown>
          if (userId) scope.setUser({ id: String(userId) })
          if (tenantId) scope.setTag('tenantId', String(tenantId))
          if (mod) scope.setTag('module', String(mod))
          scope.setExtras(extras)
        }
        Sentry.captureException(errObj)
      })
    }
  },
  fatal(message: string, context?: unknown, err?: unknown) {
    const errObj = err instanceof Error ? err : err ? new Error(String(err)) : undefined
    console.error(formatLog(createLogEntry('fatal', message, toContext(context), errObj)))
    // Fatal errors always sent to Sentry
    if (errObj) {
      Sentry.withScope((scope) => {
        scope.setLevel('fatal')
        const ctx = toContext(context)
        if (ctx) {
          const { userId, tenantId, module: mod, ...extras } = ctx as Record<string, unknown>
          if (userId) scope.setUser({ id: String(userId) })
          if (tenantId) scope.setTag('tenantId', String(tenantId))
          if (mod) scope.setTag('module', String(mod))
          scope.setExtras(extras)
        }
        Sentry.captureException(errObj)
      })
    } else {
      Sentry.captureMessage(message, { level: 'fatal' })
    }
  },
  // Helper: creates a scoped logger with tenant context for SaaS observability
  // Usage: const log = logger.withTenant('api/missions', userId, cabinetId)
  //        log.info('Mission created')
  withTenant(module: string, userId?: string, tenantId?: string) {
    const base: LogContext = { module }
    if (userId) base.userId = userId.substring(0, 8)
    if (tenantId) base.tenantId = tenantId.substring(0, 8)
    return {
      info: (msg: string, ctx?: LogContext) => logger.info(msg, { ...base, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { ...base, ...ctx }),
      error: (msg: string, ctx?: LogContext, err?: Error) => logger.error(msg, { ...base, ...ctx }, err),
    }
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
