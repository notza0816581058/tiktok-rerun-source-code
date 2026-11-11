'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';

type SetWithProducts = { id: string; productIds?: string[]; productNames?: Record<string, string> };

/** Load missing titles without delaying the existing product controls. Names persist on the server. */
export function useProductNames(sets: SetWithProducts[], accountId: string) {
  const [names, setNames] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    let active = true;
    async function load() {
      for (const item of sets) {
        if (!active) break;
        if (!(item.productIds || []).some((id) => !item.productNames?.[id])) continue;
        try {
          const response = await fetch(
            apiPath(
              `/api/live/product-sets/${item.id}/product-names?accountId=${encodeURIComponent(accountId)}`,
            ),
            { cache: 'no-store' },
          );
          if (!response.ok) continue;
          const result = await response.json();
          if (active && result.productNames && typeof result.productNames === 'object')
            setNames((current) => ({ ...current, [item.id]: result.productNames }));
        } catch {
          // Keep each product selectable by its ID if the Shop session is unavailable.
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [sets, accountId]);
  return names;
}
