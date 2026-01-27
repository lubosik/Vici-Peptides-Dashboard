import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Get credentials from environment variables
    // API routes run on Node.js runtime, so both NEXT_PUBLIC_ and non-prefixed work
    const authUser = process.env.NEXT_PUBLIC_BASIC_AUTH_USER || process.env.BASIC_AUTH_USER
    const authPass = process.env.NEXT_PUBLIC_BASIC_AUTH_PASS || process.env.BASIC_AUTH_PASS

    // Trim whitespace from input
    const trimmedUsername = username?.trim() || ''
    const trimmedPassword = password?.trim() || ''

    // Validate credentials are configured
    if (!authUser || !authPass) {
      console.error('Auth config check:', {
        hasUser: !!authUser,
        hasPass: !!authPass,
        userLength: authUser?.length,
        passLength: authPass?.length,
      })
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      )
    }

    // Compare credentials (trim env vars too, just in case)
    const trimmedAuthUser = authUser.trim()
    const trimmedAuthPass = authPass.trim()

    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log('Login attempt:', {
        providedUsername: trimmedUsername,
        providedPasswordLength: trimmedPassword.length,
        expectedUsername: trimmedAuthUser,
        expectedPasswordLength: trimmedAuthPass.length,
        usernameMatch: trimmedUsername === trimmedAuthUser,
        passwordMatch: trimmedPassword === trimmedAuthPass,
      })
    }

    if (trimmedUsername !== trimmedAuthUser || trimmedPassword !== trimmedAuthPass) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Generate a secure session token
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const cookieStore = await cookies()

    // Set secure session cookie (expires in 7 days)
    cookieStore.set('auth_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Also store the username in a separate cookie for display purposes
    cookieStore.set('auth_user', username, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    )
  }
}
