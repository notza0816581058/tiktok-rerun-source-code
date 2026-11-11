'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';
import { confirmDialog } from '@/lib/confirm';

type Helper = { id: string; name: string; online: boolean; lastSeen: string | null };

/** The .cmd a PC runs: fetches the (public, secret-free) helper script and starts it with this PC's token. */
function installer(name: string, scriptUrl: string, relayUrl: string, token: string) {
  return [
    '@echo off',
    `rem Livehub TikTok Shop helper for "${name.replace(/[^\w .-]/g, '')}". Keep this window open.`,
    'set "DIR=%USERPROFILE%\\LivehubShopHelper"',
    'if not exist "%DIR%" mkdir "%DIR%"',
    'where node >nul 2>nul || (echo Install Node.js 22 or newer from https://nodejs.org and run this file again. & pause & exit /b 1)',
    `powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing '${scriptUrl}' -OutFile \\"$env:USERPROFILE\\LivehubShopHelper\\agent.mjs\\"" || (echo Download failed. & pause & exit /b 1)`,
    'title Livehub TikTok Shop helper - keep this window open',
    `node "%DIR%\\agent.mjs" ${relayUrl} ${token}`,
    'pause',
    '',
  ].join('\r\n');
}

/**
 * TikTok only opens Streamer Desktop for Thai IPs, so GMV and basket pages read TikTok Shop through
 * a helper on the viewer's own PC. This panel lists this user's helpers and makes installers.
 */
export default function ShopRelayPanel() {
  const [items, setItems] = useState<Helper[]>([]);
  const [relayUrl, setRelayUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const base = apiPath('/api/shop-relay/agents');

  async function load() {
    const response = await fetch(base, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    setItems(data.items ?? []);
    setRelayUrl(data.relayUrl ?? null);
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    const clean = name.trim() || `PC ${new Date().toLocaleDateString('th-TH')}`;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'สร้างตัวช่วยไม่สำเร็จ');
      if (!data.relayUrl || !data.token) throw Error('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าตัวช่วย');
      const scriptUrl = new URL(apiPath('/api/shop-relay/agent-script'), window.location.href).href;
      const blob = new Blob([installer(clean, scriptUrl, data.relayUrl, data.token)], {
        type: 'application/octet-stream',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'livehub-shop-helper.cmd';
      link.click();
      URL.revokeObjectURL(link.href);
      setName('');
      setMessage(
        'ดาวน์โหลด livehub-shop-helper.cmd แล้ว: ดับเบิลคลิกบนเครื่องนี้และเปิดหน้าต่างค้างไว้ ไฟล์นี้มีรหัสเฉพาะเครื่อง ห้ามส่งต่อ',
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'สร้างตัวช่วยไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function remove(helper: Helper) {
    if (!(await confirmDialog(`ลบตัวช่วย "${helper.name}"? เครื่องนั้นจะดึงข้อมูล Shop ไม่ได้อีก`))) return;
    await fetch(`${base}/${helper.id}`, { method: 'DELETE' }).catch(() => null);
    await load();
  }

  const online = items.some((h) => h.online);
  return (
    <details className="cyber-sales-advanced" open={!online}>
      <summary>
        ตัวช่วยดึงข้อมูล Shop {online ? '🟢 ออนไลน์' : '⚪ ยังไม่มีเครื่องออนไลน์'}
      </summary>
      <div className="cyber-form-section">
        <p>
          TikTok เปิดหน้า Shop ให้เฉพาะ IP ไทย ยอดขาย GMV และตะกร้าจึงดึงผ่านเครื่องของคุณเอง
          ต้องเปิดตัวช่วยค้างไว้บนเครื่องที่ใช้ดู ตัวช่วยแค่ส่งต่อข้อมูลที่เข้ารหัสอยู่ cookie บัญชีไม่ออกจากเซิร์ฟเวอร์
        </p>
        {items.length > 0 && (
          <ul>
            {items.map((h) => (
              <li key={h.id}>
                {h.online ? '🟢' : '⚪'} {h.name}
                {!h.online && h.lastSeen && ` · ล่าสุด ${new Date(h.lastSeen).toLocaleString('th-TH')}`}{' '}
                <button type="button" onClick={() => void remove(h)}>
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        )}
        {relayUrl ? (
          <div>
            <input
              value={name}
              maxLength={60}
              placeholder="ชื่อเครื่อง เช่น คอมแอดมิน 1"
              onChange={(e) => setName(e.target.value)}
            />{' '}
            <button type="button" disabled={busy} onClick={() => void create()}>
              {busy ? 'กำลังสร้าง…' : '⬇ ติดตั้งตัวช่วยบนเครื่องนี้'}
            </button>
            <small> ต้องมี Node.js 22 ขึ้นไป</small>
          </div>
        ) : (
          <p>เซิร์ฟเวอร์นี้ดึงข้อมูล Shop ได้เองโดยตรง ไม่ต้องใช้ตัวช่วย</p>
        )}
        {message && <p>{message}</p>}
      </div>
    </details>
  );
}
