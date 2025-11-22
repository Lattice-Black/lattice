import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

interface SignupBody {
  email: string
  password: string
  name?: string
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json() as SignupBody

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    })

    // Generate initial API key
    const rawApiKey = `ltc_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex')

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        name: 'Default API Key',
      },
    })

    // Create default subscription (free tier)
    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: 'active',
        plan: 'free',
      },
    })

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      apiKey: rawApiKey, // Only returned once at signup
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
