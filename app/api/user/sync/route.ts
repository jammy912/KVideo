import { NextRequest, NextResponse } from 'next/server';
import { authenticationRequiredResponse } from '@/lib/server/api-responses';
import { getServerSession } from '@/lib/server/auth';
import { getRedisClient } from '@/lib/server/redis';

export const runtime = 'edge';

function syncUnavailableResponse() {
  return NextResponse.json(
    { error: 'Server-side sync is not configured on this deployment' },
    { status: 503 }
  );
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  const profileId = session?.profileId;

  if (!profileId) {
    return authenticationRequiredResponse();
  }

  const redis = getRedisClient();
  if (!redis) {
    return syncUnavailableResponse();
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
    return authenticationRequiredResponse();
  }

  const redis = getRedisClient();
  if (!redis) {
    return syncUnavailableResponse();
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
