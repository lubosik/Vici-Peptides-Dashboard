'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
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
  BarChart3,
  Package,
  ShoppingCart,
  Receipt,
  Upload,
  ListFilter,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Import Statement', href: '/expenses/import', icon: Upload },
  { name: 'Expense Rules', href: '/expenses/rules', icon: ListFilter },
  { name: 'Settings', href: '/settings', icon: Settings },
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
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground text-xs font-bold">VP</span>
        </div>
        <span className="text-base font-semibold text-foreground tracking-tight">Vici Peptides</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navigation.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className={cn(
                'h-4 w-4 flex-shrink-0',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-3">
        <p className="text-xs text-muted-foreground/60 px-3">v1.0 · dashboard.vicipeptides.com</p>
      </div>
    </div>
  )

  // Mobile: Hamburger menu with Sheet
  if (isMobile) {
    return (
      <>
        {/* Mobile Header with Hamburger */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background flex items-center px-3 sm:px-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-80 p-0 bg-background border-r border-border">
              <SheetHeader className="border-b border-border px-4 sm:px-6 py-3 sm:py-4">
                <SheetTitle className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl font-semibold text-foreground">Vici Peptides</span>
                </SheetTitle>
              </SheetHeader>
              <NavContent onNavigate={() => setIsOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        {/* Spacer for mobile header */}
        <div className="lg:hidden h-14" />
      </>
    )
  }

  // Desktop: Traditional sidebar
  return (
    <div className="hidden lg:flex h-screen w-64 flex-col border-r border-border bg-background">
      <NavContent />
    </div>
  )
}
