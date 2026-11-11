'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { apiPath } from '@/lib/base-path';

export async function openOwnerWorkspace(owner: string, href: string) {
  const response = await fetch(apiPath('/api/users/workspace'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner }),
  });
  if (!response.ok) throw Error('เปิดพื้นที่ของผู้รับผิดชอบไม่สำเร็จ กรุณาลองใหม่');
  window.location.assign(apiPath(href));
}

/** Open the chosen channel's library while keeping the signed-in administrator identity. */
export default function OwnerWorkspaceLink({
  owner,
  href,
  children,
  className,
}: {
  owner?: string;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <Link
        href={href}
        className={className}
        aria-disabled={busy}
        onClick={(event) => {
          if (!owner) return;
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await openOwnerWorkspace(owner, href);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          })();
        }}
      >
        {children}
      </Link>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
