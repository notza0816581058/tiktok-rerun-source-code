'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';

type State = {
  hasToken: boolean;
  hasSecret: boolean;
  enabled: boolean;
  group: { name: string | null; idEnd: string } | null;
};

/** Admin-only: LINE group alerts for dropped LIVEs and TikTok room closures (LINE Messaging API). */
export default function LineAlertsPanel() {
  const [state, setState] = useState<State | null>(null);
  const [hidden, setHidden] = useState(false);
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const base = apiPath('/api/line-alerts');
  // Read the page address after mount so the server and browser render the same first frame.
  const [webhook, setWebhook] = useState('');
  useEffect(() => setWebhook(new URL(apiPath('/api/line/webhook'), window.location.href).href), []);

  async function load() {
    const response = await fetch(base, { cache: 'no-store' }).catch(() => null);
    if (response?.status === 403) return setHidden(true);
    if (response?.ok) setState(await response.json());
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000); // shows the group once the bot joins it
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(input: Record<string, unknown>, done: string) {
    setMessage('');
    const response = await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || 'บันทึกไม่สำเร็จ');
    setState(data);
    setToken('');
    setSecret('');
    setMessage(done);
  }

  async function test() {
    setMessage('');
    const response = await fetch(`${base}/test`, { method: 'POST' });
    const data = await response.json();
    setMessage(response.ok ? 'ส่งข้อความทดสอบแล้ว ดูในกลุ่มไลน์' : data.error || 'ส่งไม่สำเร็จ');
  }

  if (hidden) return null;
  return (
    <section className="cyber-panel">
      <div className="cyber-panel-title">
        <span className="cyber-spark">▪</span> แจ้งเตือนกลุ่มไลน์
      </div>
      <div className="cyber-form-section">
        <p>
          ส่งข้อความเข้ากลุ่มไลน์เมื่อไลฟ์หลุดแล้วต่อเองไม่ได้, TikTok ปิดห้องไลฟ์, AUTO กู้ไลฟ์ไม่สำเร็จใน 5
          นาที และเมื่อระบบเริ่มทำงานใหม่ (ใช้ LINE Official Account แบบ Messaging API)
        </p>
        <ol>
          <li>สร้าง LINE Official Account และเปิด Messaging API ใน LINE Developers</li>
          <li>คัดลอก Channel access token (long-lived) และ Channel secret มาใส่ด้านล่าง แล้วกดบันทึก</li>
          <li>
            ใน LINE Developers ตั้ง Webhook URL เป็น <code>{webhook}</code> เปิด Use webhook แล้วกด Verify
          </li>
          <li>เปิด &quot;Allow bot to join group chats&quot; แล้วเชิญบอทเข้ากลุ่มไลน์ (หรือพิมพ์ /livehub ในกลุ่ม)</li>
        </ol>
        <div>
          Token: {state?.hasToken ? '✅ บันทึกแล้ว' : '—'} · Secret: {state?.hasSecret ? '✅ บันทึกแล้ว' : '—'} ·
          กลุ่ม:{' '}
          {state?.group ? `✅ ${state.group.name ?? 'กลุ่มไลน์'} (…${state.group.idEnd})` : 'ยังไม่ได้เชิญบอทเข้ากลุ่ม'} ·
          สถานะ: {state?.enabled ? 'เปิด' : 'ปิด'}
        </div>
        <div>
          <input
            type="password"
            placeholder="Channel access token"
            value={token}
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
          />{' '}
          <input
            type="password"
            placeholder="Channel secret"
            value={secret}
            autoComplete="off"
            onChange={(e) => setSecret(e.target.value)}
          />{' '}
          <button
            type="button"
            disabled={!token.trim() && !secret.trim()}
            onClick={() => void save({ token, secret }, 'บันทึกแล้ว')}
          >
            บันทึก
          </button>
        </div>
        <div>
          <button type="button" onClick={() => void save({ enabled: !state?.enabled }, 'เปลี่ยนสถานะแล้ว')}>
            {state?.enabled ? 'ปิดแจ้งเตือน' : 'เปิดแจ้งเตือน'}
          </button>{' '}
          <button type="button" disabled={!state?.group} onClick={() => void test()}>
            ส่งข้อความทดสอบ
          </button>{' '}
          {state?.group && (
            <button type="button" onClick={() => void save({ clearGroup: true }, 'ล้างกลุ่มแล้ว เชิญบอทเข้ากลุ่มใหม่ได้')}>
              เปลี่ยนกลุ่ม
            </button>
          )}
        </div>
        {message && <small>{message}</small>}
      </div>
    </section>
  );
}
