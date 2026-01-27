import { NextResponse } from 'next/server'

/**
 * Test endpoint to verify auth environment variables are accessible
 * This helps debug authentication issues
 */
export async function GET() {
  const authUser = process.env.NEXT_PUBLIC_BASIC_AUTH_USER || process.env.BASIC_AUTH_USER
  const authPass = process.env.NEXT_PUBLIC_BASIC_AUTH_PASS || process.env.BASIC_AUTH_PASS

  // Don't expose actual values, just check if they exist
  return NextResponse.json({
    configured: !!(authUser && authPass),
    hasUser: !!authUser,
    hasPass: !!authPass,
    userLength: authUser?.length || 0,
    passLength: authPass?.length || 0,
    // Show first character of username for verification (safe to expose)
    userPreview: authUser ? `${authUser[0]}...` : 'not set',
    // Show which env var was found
    userSource: process.env.NEXT_PUBLIC_BASIC_AUTH_USER ? 'NEXT_PUBLIC_BASIC_AUTH_USER' : 
                process.env.BASIC_AUTH_USER ? 'BASIC_AUTH_USER' : 'not found',
    passSource: process.env.NEXT_PUBLIC_BASIC_AUTH_PASS ? 'NEXT_PUBLIC_BASIC_AUTH_PASS' : 
                process.env.BASIC_AUTH_PASS ? 'BASIC_AUTH_PASS' : 'not found',
  })
}
