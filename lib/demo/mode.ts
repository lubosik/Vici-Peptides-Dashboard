/**
 * Demo mode utility - checks if we're running in demo mode.
 * Default is production (false): only enable when NEXT_PUBLIC_DEMO_MODE is explicitly 'true'.
 */

export const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    // Check localStorage first (for client-side)
    const stored = localStorage.getItem('demo-mode')
    if (stored !== null) {
      return stored === 'true'
    }
  }
  // Production by default: only demo when explicitly set to 'true'
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

export const setDemoMode = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('demo-mode', String(enabled))
  }
}
