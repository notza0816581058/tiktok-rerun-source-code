// Demo sign-in: two fixed sample users and a plain cookie. The real product signs sessions with
// an HMAC secret and checks users against its database; none of that is included here.
import { cookies } from 'next/headers';
import { cache } from 'react';
import { DEMO_ADMIN } from './demo/store';

export const cookieName = 'live_hub_demo_user';
export type WebsiteIdentity = {
  username: string;
  role: 'admin' | 'member';
  enabled: boolean;
  sessionVersion: number;
};

/** Sample logins shown on the login page: demo / demo (admin) and staff01 / demo (member). */
export const demoUsers: Record<string, WebsiteIdentity['role']> = { [DEMO_ADMIN]: 'admin', staff01: 'member' };
export const DEMO_PASSWORD = 'demo';

export function identityFor(username: string | undefined): WebsiteIdentity | null {
  if (!username || !(username in demoUsers)) return null;
  return { username, role: demoUsers[username], enabled: true, sessionVersion: 1 };
}

export const currentIdentity = cache(async (): Promise<WebsiteIdentity | null> =>
  identityFor((await cookies()).get(cookieName)?.value),
);

export async function currentUser() {
  return (await currentIdentity())?.username ?? null;
}
