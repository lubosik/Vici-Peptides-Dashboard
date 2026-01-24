import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Next.js automatically loads .env.local, but we need to ensure it's loaded
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time (especially on Vercel), env vars might not be available
    // Check if we're in a build context by checking for Next.js build indicators
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                       process.env.VERCEL === '1' && !supabaseUrl
    
    if (isBuildTime) {
      // During build, return a mock client that won't be used
      // Pages marked as dynamic will handle this at runtime
      // This prevents build-time errors when env vars aren't available
      const { createServerClient } = await import('@supabase/ssr')
      const cookieStore = await import('next/headers').then(m => m.cookies())
      
      // Use placeholder values - these won't be used during build
      // The actual client will be created at runtime when env vars are available
      return createServerClient(
        'https://placeholder.supabase.co',
        'placeholder-key',
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet: any[]) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch {
                // Ignore during build
              }
            },
          },
        }
      )
    }
    
    // Provide helpful error message with debugging info (runtime only)
    const envInfo = {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
      keyValue: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET',
    }
    
    console.error('Environment variables check:', envInfo)
    
    throw new Error(
      `Missing Supabase environment variables.\n` +
      `NEXT_PUBLIC_SUPABASE_URL: ${envInfo.hasUrl ? 'SET' : 'NOT SET'}\n` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${envInfo.hasKey ? 'SET' : 'NOT SET'}\n\n` +
      `Please ensure:\n` +
      `1. .env.local file exists in project root\n` +
      `2. File is saved (no unsaved changes)\n` +
      `3. Variables are named exactly: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
      `4. No quotes around values\n` +
      `5. Server was restarted after creating/updating .env.local`
    )
  }

  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
