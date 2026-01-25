import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { RealtimeProvider } from '@/components/realtime/realtime-provider'
import { ThemeProvider } from '@/components/theme/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NeonMetrics Dashboard',
  description: 'Analytics dashboard demo - NeonMetrics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RealtimeProvider>{children}</RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
