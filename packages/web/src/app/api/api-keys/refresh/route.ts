import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete existing API keys for user
    await prisma.apiKey.deleteMany({
      where: { userId: session.user.id },
    })

    // Generate new API key
    const rawApiKey = `ltc_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex')

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        keyHash,
        name: 'Default API Key',
      },
    })

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawApiKey, // Only returned once when regenerated
        createdAt: apiKey.createdAt,
      },
    })
  } catch (error) {
    console.error('Refresh API key error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh API key' },
      { status: 500 }
    )
  }
}
