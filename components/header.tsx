'use client'

import { Search, LogOut } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

export function Header() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return
    
    // Try to determine what type of search it is
    const trimmedQuery = query.trim()
    
    // Check if it's an order number (contains # or "Order" or just numbers)
    if (trimmedQuery.match(/order\s*#?\s*\d+/i) || trimmedQuery.match(/^\d+$/)) {
      const orderNum = trimmedQuery.replace(/order\s*#?\s*/i, '').trim()
      // Try to go directly to order detail page if it looks like a specific order
      if (orderNum) {
        router.push(`/orders?search=${encodeURIComponent(orderNum)}`)
      }
      return
    }
    
    // Check if it contains expense-related keywords
    if (trimmedQuery.match(/expense|shipping|inventory|software|supplies|marketing/i)) {
      router.push(`/expenses?search=${encodeURIComponent(trimmedQuery)}`)
      return
    }
    
    // Default to products search
    router.push(`/products?search=${encodeURIComponent(trimmedQuery)}`)
  }, [router])

  const debouncedSearch = useDebounce(searchQuery, 500)

  // Auto-search when debounced query changes (optional - can remove if you prefer Enter-only)
  // useEffect(() => {
  //   if (debouncedSearch) {
  //     handleSearch(debouncedSearch)
  //   }
  // }, [debouncedSearch, handleSearch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      // Force redirect even if API call fails
      router.push('/login')
    }
  }

  return (
    <div className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      {/* Search Bar - Centered */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            type="text"
            placeholder="Search orders, products, expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-12 py-2 rounded-md bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary/20 p-2 rounded-lg">
            <Search className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
      {/* Logout Button */}
      <div className="ml-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </div>
  )
}
