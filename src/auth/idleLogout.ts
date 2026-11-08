/** Idle timeout before staff are signed out (30 minutes). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
]

/**
 * Calls `onIdle` after `timeoutMs` with no user activity.
 * Returns a cleanup function.
 */
export function startIdleLogout(
  onIdle: () => void,
  timeoutMs = IDLE_TIMEOUT_MS,
) {
  let timer: ReturnType<typeof window.setTimeout> | null = null

  const clearTimer = () => {
    if (timer != null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  const arm = () => {
    clearTimer()
    timer = window.setTimeout(() => {
      onIdle()
    }, timeoutMs)
  }

  const onActivity = () => {
    arm()
  }

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true })
  }
  document.addEventListener('visibilitychange', onActivity)

  arm()

  return () => {
    clearTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity)
    }
    document.removeEventListener('visibilitychange', onActivity)
  }
}
