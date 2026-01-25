'use client'

import { Search, MessageCircle, Settings, Mail, Bell, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TopBar() {
  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-6 gap-4">
      {/* Search Bar - Centered */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            type="search"
            placeholder="SEARCH"
            className="w-full pl-10 pr-4 py-2 bg-input/50 border-border rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary neon-glow"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Right Icon Cluster */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <MessageCircle className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Mail className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>
        <span className="text-sm text-muted-foreground px-2">LOGIN</span>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
