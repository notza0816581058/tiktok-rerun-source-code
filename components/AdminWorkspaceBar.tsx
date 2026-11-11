'use client';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';

export default function AdminWorkspaceBar({ overview = false }: { overview?: boolean }) {
  const [owner, setOwner] = useState(''),
    [actor, setActor] = useState(''),
    [users, setUsers] = useState<{ username: string; enabled: boolean }[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.all(
      ['/workspace', ''].map(async (path) => {
        const res = await fetch(apiPath('/api/users' + path), { cache: 'no-store' });
        if (!res.ok) throw Error('โหลดพื้นที่ผู้ใช้ไม่สำเร็จ');
        return res.json();
      }),
    )
      .then(([workspace, people]) => {
        if (active) {
          setOwner(workspace.owner);
          setActor(workspace.actor);
          setUsers(people.items);
        }
      })
      .catch(() => {
        if (active) setError('โหลดพื้นที่ผู้ใช้ไม่สำเร็จ กรุณารีเฟรช');
      });
    return () => {
      active = false;
    };
  }, []);
  async function select(value: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(apiPath('/api/users/workspace'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: value }),
      });
      if (!res.ok) throw Error('เปลี่ยนพื้นที่ผู้ใช้ไม่สำเร็จ');
      window.location.assign(apiPath('/dashboard'));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="tenant-workspace" aria-label="พื้นที่จัดการของผู้ดูแล">
      {overview && <strong>ผู้ดูแล · มองเห็นและจัดการได้ทุกช่อง</strong>}
      <label>
        {overview ? 'พื้นที่คลังและการเพิ่มบัญชี' : 'ผู้ดูแลกำลังจัดการข้อมูลของ'}
        <select
          aria-label="เลือกพื้นที่ผู้ใช้"
          value={owner}
          disabled={busy || !owner}
          onChange={(e) => void select(e.target.value)}
        >
          {!owner && <option value="">กำลังโหลด…</option>}
          {users.map((u) => (
            <option value={u.username} key={u.username}>
              {u.username}
              {u.username === actor ? ' (ของฉัน)' : ''}
              {!u.enabled ? ' · ปิดการเข้าสู่ระบบ' : ''}
            </option>
          ))}
        </select>
      </label>
      {owner && owner !== actor && (
        <button className="cyber-btn" disabled={busy} onClick={() => void select(actor)}>
          กลับข้อมูลของฉัน
        </button>
      )}
      <a className="cyber-btn cyan" href={apiPath('/users')}>
        ผู้ใช้และการมอบหมาย
      </a>
      {error && <span role="alert">{error}</span>}
    </section>
  );
}
