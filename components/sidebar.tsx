'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  TrendingUp,
  Settings,
  BarChart3,
  Star,
  MessageSquare,
  Mail,
  Home,
} from 'lucide-react'

const primaryNavigation = [
  { name: 'DASHBOARD', href: '/', icon: Home },
  { name: 'CHART', href: '/analytics', icon: BarChart3 },
  { name: 'APPS', href: '/products', icon: Star },
  { name: 'FORUM', href: '/orders', icon: MessageSquare },
  { name: 'EMAIL', href: '/expenses', icon: Mail },
  { name: 'SETTING', href: '/settings', icon: Settings },
]

const secondaryNavigation = [
  { name: 'OPTION', href: '#' },
  { name: 'CASE', href: '#' },
  { name: 'LOCAL', href: '#' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const NavContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-6 px-4 py-6">
      {/* Primary Navigation */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Dashboard
        </div>
        <div className="space-y-1">
          {primaryNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative group',
                  isActive
                    ? 'bg-primary/20 text-primary neon-text border-l-2 border-primary'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn(
                    'h-5 w-5',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span>{item.name}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Secondary Navigation */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Projects
        </div>
        <div className="space-y-1">
          {secondaryNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )

  // Mobile: Hamburger menu with Sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-foreground">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border">
              <SheetHeader className="border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <Menu className="h-5 w-5 text-primary" />
                  <SheetTitle className="text-primary neon-text font-bold">Dashboard</SheetTitle>
                </div>
              </SheetHeader>
              <NavContent onNavigate={() => setIsOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-primary neon-text font-bold text-lg">NeonMetrics</span>
          </div>
        </div>
        {/* Spacer for mobile header */}
        <div className="lg:hidden h-16" />
      </>
    )
  }

  // Desktop: Traditional sidebar
  return (
    <div className="hidden lg:flex h-screen w-64 flex-col border-r border-border bg-card/80 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Menu className="h-5 w-5 text-primary" />
        <span className="text-primary neon-text font-bold text-lg">Dashboard</span>
      </div>
      <NavContent />
    </div>
  )
}
