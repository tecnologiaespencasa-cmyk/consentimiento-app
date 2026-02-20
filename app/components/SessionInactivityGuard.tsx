"use client"

import { useCallback, useEffect, useRef } from "react"
import { signOut, useSession } from "next-auth/react"

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000
const LAST_ACTIVITY_KEY = "session:last-activity-at"
const FORCE_LOGOUT_KEY = "session:force-logout-at"

function parseTimestamp(value: string | null): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export default function SessionInactivityGuard() {
  const { status } = useSession()
  const timeoutRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(0)
  const isSigningOutRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const triggerLogout = useCallback(async (broadcast = true) => {
    if (isSigningOutRef.current) return
    isSigningOutRef.current = true

    if (broadcast) {
      try {
        localStorage.setItem(FORCE_LOGOUT_KEY, String(Date.now()))
      } catch {
        // Ignore localStorage errors (private mode, quota, etc.)
      }
    }

    try {
      await signOut({ callbackUrl: "/login?motivo=inactividad" })
    } catch {
      isSigningOutRef.current = false
    }
  }, [])

  const scheduleLogout = useCallback(() => {
    if (status !== "authenticated") return

    clearTimer()

    const elapsed = Date.now() - lastActivityRef.current
    const remaining = INACTIVITY_LIMIT_MS - elapsed

    if (remaining <= 0) {
      void triggerLogout()
      return
    }

    timeoutRef.current = window.setTimeout(() => {
      void triggerLogout()
    }, remaining)
  }, [clearTimer, status, triggerLogout])

  useEffect(() => {
    if (status !== "authenticated") {
      clearTimer()
      isSigningOutRef.current = false
      return
    }

    const storedActivity = parseTimestamp(localStorage.getItem(LAST_ACTIVITY_KEY))

    if (storedActivity) {
      lastActivityRef.current = storedActivity
    } else {
      const now = Date.now()
      lastActivityRef.current = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
    }

    scheduleLogout()

    const handleUserActivity = () => {
      const now = Date.now()

      // Avoid excessive writes for very noisy events.
      if (now - lastActivityRef.current < 1000) {
        return
      }

      lastActivityRef.current = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
      scheduleLogout()
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState && document.visibilityState !== "visible") {
        return
      }

      const syncedActivity = parseTimestamp(localStorage.getItem(LAST_ACTIVITY_KEY))
      if (syncedActivity) {
        lastActivityRef.current = Math.max(lastActivityRef.current, syncedActivity)
      }

      scheduleLogout()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        const updatedActivity = parseTimestamp(event.newValue)
        if (!updatedActivity) return

        lastActivityRef.current = updatedActivity
        scheduleLogout()
        return
      }

      if (event.key === FORCE_LOGOUT_KEY && event.newValue) {
        void triggerLogout(false)
      }
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ]

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleUserActivity, { passive: true })
    }

    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("storage", handleStorage)

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleUserActivity)
      }

      window.removeEventListener("focus", handleVisibilityOrFocus)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      window.removeEventListener("storage", handleStorage)
      clearTimer()
    }
  }, [clearTimer, scheduleLogout, status, triggerLogout])

  return null
}
