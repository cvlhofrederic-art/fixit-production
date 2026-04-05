// ── Event Tracking Library — GDPR-compliant, batched, lightweight ────────────
// Client-side: queues events, batches to /api/analytics/track every 5s or on unload.
// Respects cookie consent (localStorage 'vitfix_cookie_consent' performance flag).
// No external dependencies.

export const AnalyticsEventType = {
  PAGE_VIEW: 'page_view',
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  PROFILE_COMPLETED: 'profile_completed',
  BOOKING_CREATED: 'booking_created',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_COMPLETED: 'booking_completed',
  REVIEW_SUBMITTED: 'review_submitted',
  SEARCH_PERFORMED: 'search_performed',
  DEVIS_GENERATED: 'devis_generated',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  FEATURE_USED: 'feature_used',
  ERROR_OCCURRED: 'error_occurred',
} as const

export type EventType = (typeof AnalyticsEventType)[keyof typeof AnalyticsEventType]

export interface AnalyticsEvent {
  event_type: EventType
  user_id?: string
  session_id: string
  properties: Record<string, unknown>
  timestamp: string
  page_url: string
  user_agent: string
}

// ── Consent check ────────────────────────────────────────────────────────────

function isConsentGiven(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('vitfix_cookie_consent')
    if (!raw) return false
    const consent = JSON.parse(raw)
    return consent?.performance === true
  } catch {
    return false
  }
}

// ── Session ID (persisted per tab) ───────────────────────────────────────────

let _sessionId: string | null = null

function getSessionId(): string {
  if (_sessionId) return _sessionId
  if (typeof window !== 'undefined') {
    _sessionId = sessionStorage.getItem('vitfix_session_id')
    if (!_sessionId) {
      _sessionId = crypto.randomUUID()
      sessionStorage.setItem('vitfix_session_id', _sessionId)
    }
  } else {
    _sessionId = crypto.randomUUID()
  }
  return _sessionId
}

// ── Queue & flush ────────────────────────────────────────────────────────────

let queue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let _userId: string | undefined
let _userTraits: Record<string, unknown> = {}

const FLUSH_INTERVAL_MS = 5_000
const MAX_QUEUE_SIZE = 100
const ENDPOINT = '/api/analytics/track'

function flush(): void {
  if (queue.length === 0) return
  const batch = queue.splice(0, MAX_QUEUE_SIZE)

  // sendBeacon for unload reliability, fetch otherwise
  const payload = JSON.stringify({ events: batch })

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
    if (!sent) {
      // fallback to fetch, fire-and-forget
      fetch(ENDPOINT, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
    }
  } else {
    fetch(ENDPOINT, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
  }
}

function startFlushTimer(): void {
  if (flushTimer) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('pagehide', flush)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a custom event. Silently no-ops when consent is not given.
 */
export function trackEvent(type: EventType, properties: Record<string, unknown> = {}): void {
  if (!isConsentGiven()) return

  const event: AnalyticsEvent = {
    event_type: type,
    user_id: _userId,
    session_id: getSessionId(),
    properties: { ..._userTraits, ...properties },
    timestamp: new Date().toISOString(),
    page_url: typeof window !== 'undefined' ? window.location.href : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }

  queue.push(event)
  startFlushTimer()

  if (queue.length >= MAX_QUEUE_SIZE) flush()
}

/**
 * Track a page view. Call on route changes.
 */
export function trackPageView(extraProps: Record<string, unknown> = {}): void {
  trackEvent(AnalyticsEventType.PAGE_VIEW, {
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    ...extraProps,
  })
}

/**
 * Link the current session to an authenticated user.
 * Traits are merged into every subsequent event's properties.
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  _userId = userId
  if (traits) _userTraits = { ...traits }
}

/**
 * Clear user identity (call on logout).
 */
export function resetUser(): void {
  _userId = undefined
  _userTraits = {}
}
