/**
 * Demo mode utility - checks if we're running in demo mode
 */

export const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    // Check localStorage first (for client-side)
    const stored = localStorage.getItem('demo-mode')
    if (stored !== null) {
      return stored === 'true'
    }
  }
  
  // Check environment variable (defaults to true for demo build)
  return process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
}

export const setDemoMode = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('demo-mode', String(enabled))
  }
}
