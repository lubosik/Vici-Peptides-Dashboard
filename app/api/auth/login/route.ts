import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Get credentials from environment variables
    const authUser = process.env.NEXT_PUBLIC_BASIC_AUTH_USER || process.env.BASIC_AUTH_USER
    const authPass = process.env.NEXT_PUBLIC_BASIC_AUTH_PASS || process.env.BASIC_AUTH_PASS

    // Validate credentials
    if (!authUser || !authPass) {
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 500 }
      )
    }

    if (username !== authUser || password !== authPass) {
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
