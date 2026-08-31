import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the GitHub access token from the Account model
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
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`)
    }

    const repos = await response.json()
    
    // Map to a cleaner format for the frontend
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      owner: repo.owner.login
    }))

    // Check which ones are already connected
    const connectedRepos = await prisma.connectedRepo.findMany({
      where: { userId: (session.user as any).id },
      select: { repoFullName: true }
    })
    
    const connectedSet = new Set(connectedRepos.map(r => r.repoFullName))

    return NextResponse.json({
      repos: formattedRepos.map((r: any) => ({
        ...r,
        isConnected: connectedSet.has(r.fullName)
      }))
    })
  } catch (error: any) {
    console.error('Failed to fetch repos:', error)
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 })
  }
}
