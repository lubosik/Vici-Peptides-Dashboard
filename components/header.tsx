'use client'

import { Search, MessageCircle, Settings, Mail, Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Header() {
  return (
    <div className="h-16 glass-card border-b border-border/30 flex items-center justify-between px-6">
      {/* Search Bar - Centered */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            type="text"
            placeholder="SEARCH"
            className="w-full pl-4 pr-12 py-2 rounded-full bg-input/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 neon-glow-cyan"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary/20 p-2 rounded-lg">
            <Search className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Right Utility Icons */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <MessageCircle className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Mail className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-accent rounded-full" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">LOGIN</span>
          <Button variant="ghost" size="icon" className="relative">
            <User className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-accent rounded-full">
              <Bell className="h-3 w-3 text-foreground" />
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
