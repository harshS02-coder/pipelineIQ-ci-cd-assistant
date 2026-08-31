import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { repoFullName, owner } = body

  if (!repoFullName || !owner) {
    return NextResponse.json({ error: 'repoFullName and owner are required' }, { status: 400 })
  }

  // Get the GitHub access token
  const account = await prisma.account.findFirst({
    where: {
      userId: (session.user as any).id,
      provider: 'github'
    }
  })

  if (!account || !account.access_token) {
    return NextResponse.json({ error: 'GitHub account not linked' }, { status: 400 })
  }

  try {
    // Generate a secure random secret for this webhook
    const webhookSecret = crypto.randomBytes(32).toString('hex')
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/github`

    // Call GitHub API to create the webhook
    const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'workflow_run'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0'
        }
      })
    })

    if (!ghRes.ok) {
      const errorText = await ghRes.text()
      console.error('GitHub Webhook creation failed:', errorText)
      throw new Error('Failed to create webhook on GitHub')
    }

    const webhookData = await ghRes.json()

    // Store the connection in the DB
    // In a real production app, encrypt webhookSecret before storing!
    const connectedRepo = await prisma.connectedRepo.create({
      data: {
        repoFullName,
        owner,
        webhookId: webhookData.id.toString(),
        webhookSecret,
        userId: (session.user as any).id
      }
    })

    return NextResponse.json({ success: true, repo: connectedRepo })
  } catch (error: any) {
    console.error('Failed to connect repo:', error)
    return NextResponse.json({ error: 'Failed to connect repository' }, { status: 500 })
  }
}
