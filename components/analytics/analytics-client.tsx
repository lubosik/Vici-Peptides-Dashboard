'use client'

import { useRouter } from 'next/navigation'
import { usePeriodicRefetch } from '@/lib/hooks/use-periodic-refetch'

/**
 * Wrapper for analytics page: refreshes server data every 60s for near real-time updates.
 */
export function AnalyticsClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  usePeriodicRefetch({
    refetch: () => router.refresh(),
    intervalMs: 60000,
    enabled: true,
  })
  return <>{children}</>
}
