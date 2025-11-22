import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        lastUsed: true,
        createdAt: true,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'No API key found' }, { status: 404 })
    }

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        lastUsed: apiKey.lastUsed,
        createdAt: apiKey.createdAt,
        // We don't return the actual key - it's only shown once at creation
        keyPreview: 'ltc_****...****',
      },
    })
  } catch (error) {
    console.error('Get API key error:', error)
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    )
  }
}
