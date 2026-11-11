'use client';

import { useState } from 'react';
import { apiPath } from '@/lib/base-path';
import { buildSalesWorkbook, monthLabel, type ExportChannel } from '@/lib/sales-export';

type Account = { id: string; alias: string; verifiedHandle?: string | null };

const previousMonth = () => {
  const now = new Date(Date.now() + 7 * 3_600_000); // Bangkok
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Monthly Excel per channel (like the team's commission file). Each channel's month is read from
 * TikTok Shop one at a time, so the page shows progress and a failed channel does not stop the rest.
 */
export default function SalesExportPanel({ accounts }: { accounts: Account[] }) {
  const [month, setMonth] = useState(previousMonth);
  const [ratePercent, setRatePercent] = useState('2');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportMonth() {
    const rate = Number(ratePercent) / 100;
    if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(rate) || rate < 0 || rate > 1) {
      setProgress('เลือกเดือนและใส่อัตราค่าคอมมิชชั่น 0–100%');
      return;
    }
    setBusy(true);
    const channels: ExportChannel[] = [];
    try {
      for (const [i, a] of accounts.entries()) {
        setProgress(`กำลังดึงยอด ${i + 1}/${accounts.length}: ${a.alias}…`);
        const base = { alias: a.alias, username: a.verifiedHandle || a.alias };
        try {
          const response = await fetch(
            apiPath(`/api/live/sessions/${encodeURIComponent(a.id)}/sales/month?month=${month}`),
            { cache: 'no-store' },
          );
          const data = await response.json();
          if (!response.ok) throw Error(data.error || 'อ่านยอดขายไม่สำเร็จ');
          channels.push({ ...base, rooms: data.rooms });
        } catch (e) {
          channels.push({ ...base, rooms: null, error: e instanceof Error ? e.message : 'อ่านยอดขายไม่สำเร็จ' });
        }
      }
      setProgress('กำลังสร้างไฟล์ Excel…');
      const blob = await buildSalesWorkbook(month, rate, channels);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `สรุปยอดขายรายช่องและค่าคอมมิชชั่น_${monthLabel(month).short.replace(/\s/g, '')}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
      const failed = channels.filter((c) => !c.rooms).length;
      setProgress(
        failed
          ? `ส่งออกแล้ว แต่ดึงไม่สำเร็จ ${failed} ช่อง (ดูชีต "แหล่งข้อมูล")`
          : `ส่งออกแล้ว ${channels.length} ช่อง`,
      );
    } catch {
      setProgress('สร้างไฟล์ Excel ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cyber-form-section">
      <p>
        <strong>ส่งออก Excel รายเดือน</strong> · สรุป GMV รายช่อง + ค่าคอมมิชชั่น + รายการ LIVE ทุกห้อง
        (ดึงจาก TikTok Shop ทีละช่อง ใช้เวลาราว 10–30 วินาทีต่อช่อง)
      </p>
      <div>
        <input
          type="month"
          value={month}
          max={previousMonth().slice(0, 4) + '-12'}
          onChange={(e) => setMonth(e.target.value)}
          disabled={busy}
        />{' '}
        <label>
          ค่าคอมฯ{' '}
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
            disabled={busy}
            style={{ width: '5em' }}
          />
          %
        </label>{' '}
        <button type="button" disabled={busy || !accounts.length} onClick={() => void exportMonth()}>
          {busy ? 'กำลังส่งออก…' : '⬇ ส่งออก Excel'}
        </button>
      </div>
      {progress && <small>{progress}</small>}
    </div>
  );
}
