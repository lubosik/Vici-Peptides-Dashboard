'use client'

import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { NeonDashboard } from '@/components/dashboard/neon-dashboard'
import { useEffect } from 'react'
import { useDemoStore } from '@/lib/demo/store'

export default function DashboardPage() {
  const store = useDemoStore()

  // Initialize demo data on mount if empty
  useEffect(() => {
    if (store.orders.length === 0 && store.products.length === 0) {
      store.resetData()
    }
  }, [store])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6 lg:p-8">
            <NeonDashboard />
          </div>
        </main>
      </div>
    </div>
  )
}
