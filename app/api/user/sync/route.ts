import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/server/auth';

export const runtime = 'edge';

const redis = Redis.fromEnv();

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  try {
    const data = await redis.get(`user:sync:${profileId}`);
    return NextResponse.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Redis Get Error:', error);
    return NextResponse.json({ error: 'Failed to fetch sync data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const key = `user:sync:${profileId}`;

    const existing = (await redis.get(key)) as Record<string, unknown> | null;
    const merged = { ...(existing || {}), ...body, updatedAt: Date.now() };

    await redis.set(key, merged);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redis Set Error:', error);
    return NextResponse.json({ error: 'Failed to save sync data' }, { status: 500 });
  }
}
