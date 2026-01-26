import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, env vars might not be available
  // Return a placeholder client that won't be used during build
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      // Server-side/build time - return placeholder
      return createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      )
    }
    // Client-side runtime - throw error
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
