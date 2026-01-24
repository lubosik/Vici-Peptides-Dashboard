import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Home } from 'lucide-react'

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl mb-2">404</CardTitle>
          <CardDescription className="text-lg">
            Page not found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
