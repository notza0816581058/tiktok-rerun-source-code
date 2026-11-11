import { NextResponse } from 'next/server';
import { cookieName, DEMO_PASSWORD, identityFor } from '@/lib/auth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const identity = typeof body.username === 'string' ? identityFor(body.username.trim()) : null;
  if (!identity || body.password !== DEMO_PASSWORD)
    return NextResponse.json({ error: 'ใช้ demo / demo หรือ staff01 / demo' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, identity.username, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400 });
  return response;
}
