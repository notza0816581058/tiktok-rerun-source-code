'use client';

import { useEffect, useRef, useState } from 'react';
import { apiPath } from '@/lib/base-path';

type Totals = { gmv: number; itemsSold: number; rooms: number };
type Day = Totals & { day: string };
type Summary = {
  today: Day;
  last7: Totals;
  last30: Totals;
  days: Day[];
  updatedAt: string | null;
  checkedAt?: string | null;
  liveRoomId: string | null;
};

// Re-read the stored totals (database only); the server refreshes them from Shop every 10 minutes.
const STORED_POLL_MS = 60_000;
const baht = (n: number) =>
  `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thaiDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/**
 * GMV from the account's TikTok Shop LIVE performance, counted by the day each LIVE started.
 * The server reads every account from Shop every 10 minutes, one at a time; this card only shows
 * the stored numbers (re-read from the database each minute). ↻ asks for one read right away.
 */
export default function AccountSalesStrip({
  accountId,
  title,
  live = false,
}: {
  accountId: string;
  title?: string;
  live?: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const base = apiPath(`/api/live/sessions/${encodeURIComponent(accountId)}/sales`);
  const isLive = live || !!summary?.liveRoomId;

  async function refreshNow() {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const response = await fetch(`${base}/refresh?range=last30`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'อ่านยอดขายไม่สำเร็จ');
      setSummary(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อ่านยอดขายไม่สำเร็จ');
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }

  // Stored numbers only: no TikTok read from here, so open pages never add load on the server.
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(base, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Summary | null) => {
          if (active && data) setSummary(data);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, STORED_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [base]);

  if (!summary && !refreshing && !error) return null;
  const last = summary?.checkedAt ?? summary?.updatedAt;
  const updated = last
    ? `ดึงล่าสุด ${new Date(last).toLocaleString('th-TH')}`
    : 'ยังไม่เคยดึงยอดจาก TikTok Shop';
  const tiles: [string, Totals | undefined][] = [
    ['วันนี้', summary?.today],
    ['7 วัน', summary?.last7],
    ['30 วัน', summary?.last30],
  ];
  const soldDays = (summary?.days ?? []).filter((d) => d.gmv > 0 || d.rooms > 0).reverse();

  return (
    <div className="cyber-sales-strip">
      <div className="cyber-sales-head">
        <span>
          💰 {title ? `${title} · ` : ''}ยอดขาย LIVE (GMV)
          {isLive && <span className="cyber-sales-live"> 🔴 กำลังไลฟ์</span>}
        </span>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refreshNow()}
          title="ดึงยอด 30 วันล่าสุดจาก TikTok Shop ตอนนี้ (เข้าคิวทีละช่อง)"
        >
          {refreshing ? 'กำลังดึง…' : '↻'}
        </button>
      </div>
      <div className="cyber-sales-tiles">
        {tiles.map(([label, t]) => (
          <div key={label} className={`cyber-sales-tile${label === 'วันนี้' ? ' today' : ''}`}>
            <small>
              {label}
            </small>
            <strong>{t ? baht(t.gmv) : '—'}</strong>
            <small>
              {t ? `${t.itemsSold.toLocaleString('th-TH')} ชิ้น · ${t.rooms} ไลฟ์` : ''}
            </small>
          </div>
        ))}
      </div>
      {soldDays.length > 0 && (
        <details className="cyber-sales-days">
          <summary>ดูรายวัน ({soldDays.length} วันที่มีไลฟ์)</summary>
          <table>
            <tbody>
              {soldDays.map((d) => (
                <tr key={d.day}>
                  <td>{thaiDay(d.day)}</td>
                  <td>{baht(d.gmv)}</td>
                  <td>{d.itemsSold.toLocaleString('th-TH')} ชิ้น</td>
                  <td>{d.rooms} ไลฟ์</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <small className="cyber-sales-note">
        {error
          ? error
          : `${updated} · ดึงอัตโนมัติทุก 10 นาที ทีละช่อง · นับตามวันที่เริ่มไลฟ์`}
      </small>
    </div>
  );
}
