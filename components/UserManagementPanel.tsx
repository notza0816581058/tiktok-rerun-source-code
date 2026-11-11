'use client';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';
type User = {
  username: string;
  role: 'admin' | 'member';
  enabled: boolean;
  createdAt: string;
  legacy?: boolean;
};
type ManagedAccount = { id: string; owner: string; alias: string; handle?: string | null };
async function request(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(apiPath('/api/users' + path), {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    }),
    data = await res.json();
  if (!res.ok) throw Error(data.error ?? 'ทำรายการไม่สำเร็จ');
  return data;
}
export default function UserManagementPanel() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]),
    [assignees, setAssignees] = useState<Record<string, string>>({}),
    [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [editing, setEditing] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [newConfirmation, setNewConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function refresh() {
    const [people, tiktok] = await Promise.all([request(''), request('/accounts')]);
    setUsers(people.items);
    setAccounts(tiktok.items);
    setAssignees({});
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  return (
    <section className="cyber-panel">
      <div className="cyber-panel-title">
        <span className="cyber-spark">▪</span>ผู้ใช้ Live Hub
      </div>
      <div className="cyber-panel-body tenant-users">
        <p>
          ผู้ดูแลเห็นและจัดการบัญชี TikTok ทั้งหมด มอบหมายแต่ละบัญชีให้ผู้ใช้ได้หนึ่งคน
          ผู้ใช้ทั่วไปเห็นเฉพาะบัญชีและข้อมูลที่ได้รับมอบหมาย
        </p>
        <form
          className="tenant-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (password !== confirmation) throw Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
              await request('', 'POST', { username, password });
              setUsername('');
              setPassword('');
              setConfirmation('');
              await refresh();
              setNotice('สร้างผู้ใช้แล้ว เลือกมอบหมายบัญชี TikTok ด้านล่างได้เลย');
            });
          }}
        >
          <h3>เพิ่มผู้ใช้</h3>
          <div className="tenant-user-fields">
            <label>
              ชื่อผู้ใช้
              <input
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[A-Za-z0-9][A-Za-z0-9_.@-]{2,63}"
                minLength={3}
                maxLength={64}
                required
                disabled={busy}
              />
              <small>3–64 ตัว ใช้ภาษาอังกฤษ ตัวเลข . _ @ หรือ -</small>
            </label>
            <label>
              รหัสผ่าน
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              <small>ตั้งความยาวได้เอง ต้องไม่เว้นว่าง</small>
            </label>
            <label>
              ยืนยันรหัสผ่าน
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                disabled={busy}
              />
            </label>
          </div>
          <button className="cyber-btn pink" disabled={busy}>
            {busy ? 'กำลังดำเนินการ…' : 'สร้างผู้ใช้'}
          </button>
        </form>
        {error && (
          <p className="cyber-account-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="cyber-live-notice" role="status">
            {notice}
          </p>
        )}
        <div className="tenant-user-list">
          <div className="tenant-user-row">
            <h3>จัดสรรบัญชี TikTok ทั้งหมด ({accounts.length})</h3>
            <button className="cyber-btn" disabled={busy} onClick={() => void run(refresh)}>
              รีเฟรชรายการ
            </button>
          </div>
          <label>
            ค้นหาช่องหรือผู้รับผิดชอบ
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อช่อง, @TikTok หรือชื่อผู้ใช้"
            />
          </label>
          <p>
            ย้ายได้เมื่อหยุดไลฟ์และงานของบัญชีแล้ว ค่าตั้ง AI, session แชท, ชุดสินค้า
            และคลิปที่ใช้อยู่จะตามไปด้วย
          </p>
          <p>
            หลังย้าย ระบบพักการตอบ AI และเวลาเริ่มไลฟ์อัตโนมัติ
            ให้ผู้รับผิดชอบตรวจค่าตั้งแล้วเปิดใช้งานอีกครั้ง
          </p>
          {accounts
            .filter((a) =>
              `${a.alias} ${a.handle ?? ''} ${a.owner}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((account) => (
              <div className="tenant-user-card" key={account.id}>
                <div className="tenant-user-row">
                  <div>
                    <strong>{account.alias}</strong>
                    <p>
                      {account.handle
                        ? '@' + account.handle.replace(/^@/, '')
                        : 'ยังไม่ยืนยันชื่อ TikTok'}{' '}
                      · ผู้รับผิดชอบ: {account.owner}
                    </p>
                  </div>
                  <button
                    className="cyber-btn cyan"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await request('/workspace', 'POST', { owner: account.owner });
                        window.location.assign(apiPath('/dashboard'));
                      })
                    }
                  >
                    จัดการบัญชี
                  </button>
                </div>
                <div className="tenant-user-actions">
                  <label>
                    มอบหมายให้
                    <select
                      aria-label={'ผู้รับผิดชอบ ' + account.alias}
                      value={assignees[account.id] ?? account.owner}
                      disabled={busy}
                      onChange={(e) =>
                        setAssignees((old) => ({ ...old, [account.id]: e.target.value }))
                      }
                    >
                      {!users.some((u) => u.username === account.owner && u.enabled) && (
                        <option value={account.owner}>{account.owner} (ปิดการเข้าสู่ระบบ)</option>
                      )}
                      {users
                        .filter((u) => u.enabled)
                        .map((u) => (
                          <option value={u.username} key={u.username}>
                            {u.username}
                            {u.role === 'admin' ? ' (ผู้ดูแล)' : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="cyber-btn pink"
                    disabled={
                      busy || !assignees[account.id] || assignees[account.id] === account.owner
                    }
                    onClick={() => {
                      const owner = assignees[account.id];
                      if (
                        !window.confirm(
                          `มอบหมาย ${account.alias} จาก ${account.owner} ให้ ${owner}? ผู้ใช้เดิมจะเข้าถึงบัญชีนี้ไม่ได้ ค่าตั้งและคลิปที่ใช้จะตามไป และพัก AI/เวลาเริ่มไลฟ์อัตโนมัติให้ตรวจใหม่`,
                        )
                      )
                        return;
                      void run(async () => {
                        await request('/accounts/' + account.id + '/assign', 'POST', {
                          owner,
                          previousOwner: account.owner,
                        });
                        await refresh();
                        setNotice(`มอบหมาย ${account.alias} ให้ ${owner} แล้ว`);
                      });
                    }}
                  >
                    บันทึกผู้รับผิดชอบ
                  </button>
                </div>
              </div>
            ))}
          {!accounts.length && <p>ยังไม่มีบัญชี TikTok ในระบบ</p>}
        </div>
        <div className="tenant-user-list">
          <h3>ผู้ใช้ทั้งหมด ({users.length})</h3>
          {users.map((user) => (
            <div className="tenant-user-card" key={user.username}>
              <div className="tenant-user-row">
                <div>
                  <strong>{user.username}</strong>
                  <p>
                    {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.legacy ? 'ผู้ใช้เดิม' : 'ผู้ใช้'}{' '}
                    · {user.enabled ? 'เปิดใช้งาน' : 'ปิดการเข้าสู่ระบบ'}
                  </p>
                </div>
                <button
                  className="cyber-btn cyan"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (user.role === 'admin') {
                        window.location.assign(apiPath('/dashboard'));
                        return;
                      }
                      await request('/workspace', 'POST', { owner: user.username });
                      window.location.assign(apiPath('/dashboard'));
                    })
                  }
                >
                  {user.role === 'admin' ? 'ดูทุกช่อง' : 'เปิดพื้นที่ผู้ใช้'} ·{' '}
                  {user.role === 'admin'
                    ? accounts.length
                    : accounts.filter((a) => a.owner === user.username).length}{' '}
                  บัญชี
                </button>
                {user.role === 'member' && (
                  <div className="tenant-user-actions">
                    <button
                      className="cyber-btn"
                      disabled={busy}
                      onClick={() => {
                        setEditing(editing === user.username ? '' : user.username);
                        setNewPassword('');
                        setNewConfirmation('');
                      }}
                    >
                      ตั้งรหัสผ่านใหม่
                    </button>
                    <button
                      className={'cyber-btn ' + (user.enabled ? 'danger' : 'cyan')}
                      disabled={busy}
                      onClick={() => {
                        if (
                          user.enabled &&
                          !window.confirm(
                            `ปิดการเข้าสู่ระบบของ ${user.username}? ผู้ใช้จะถูกออกจากระบบทันที ข้อมูล TikTok ยังคงอยู่ และงานไลฟ์ที่เริ่มไว้จะไม่ถูกหยุด`,
                          )
                        )
                          return;
                        void run(async () => {
                          await request('/' + encodeURIComponent(user.username), 'PATCH', {
                            enabled: !user.enabled,
                          });
                          await refresh();
                          setNotice(
                            user.enabled ? 'ปิดการเข้าสู่ระบบแล้ว' : 'เปิดใช้งานผู้ใช้แล้ว',
                          );
                        });
                      }}
                    >
                      {user.enabled ? 'ปิดการเข้าสู่ระบบ' : 'เปิดใช้งาน'}
                    </button>
                    <button
                      className="cyber-btn danger"
                      disabled={busy || accounts.some((account) => account.owner === user.username)}
                      onClick={() => {
                        if (accounts.some((account) => account.owner === user.username)) {
                          setError(
                            'ย้ายบัญชี TikTok ของผู้ใช้นี้ให้ผู้รับผิดชอบคนอื่นก่อนลบผู้ใช้',
                          );
                          setNotice('');
                          return;
                        }
                        if (
                          !window.confirm(
                            `ลบผู้ใช้ ${user.username}? ผู้ใช้จะออกจากระบบและหายจากรายการทันที ชื่อเดิมจะใช้ซ้ำไม่ได้ และข้อมูลคลังที่เหลือจะเก็บสำรองไว้`,
                          )
                        )
                          return;
                        void run(async () => {
                          await request('/' + encodeURIComponent(user.username), 'DELETE', {
                            confirmation: user.username,
                          });
                          if (editing === user.username) {
                            setEditing('');
                            setNewPassword('');
                            setNewConfirmation('');
                          }
                          await refresh();
                          setNotice(`ลบผู้ใช้ ${user.username} แล้ว`);
                        });
                      }}
                    >
                      ลบผู้ใช้
                    </button>
                    {accounts.some((account) => account.owner === user.username) && (
                      <small>ย้ายบัญชี TikTok ให้ผู้รับผิดชอบคนอื่นก่อนลบผู้ใช้</small>
                    )}
                  </div>
                )}
              </div>
              {editing === user.username && (
                <form
                  className="tenant-user-reset"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      if (newPassword !== newConfirmation)
                        throw Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
                      await request('/' + encodeURIComponent(user.username), 'PATCH', {
                        password: newPassword,
                      });
                      setNewPassword('');
                      setNewConfirmation('');
                      setEditing('');
                      await refresh();
                      setNotice('ตั้งรหัสผ่านใหม่แล้ว ผู้ใช้ต้องเข้าสู่ระบบอีกครั้ง');
                    });
                  }}
                >
                  <label>
                    รหัสผ่านใหม่
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </label>
                  <label>
                    ยืนยันรหัสผ่านใหม่
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newConfirmation}
                      onChange={(e) => setNewConfirmation(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </label>
                  <button className="cyber-btn cyan" disabled={busy}>
                    บันทึกรหัสผ่านใหม่
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function PasswordSettingsPanel() {
  const [currentPassword, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="cyber-panel">
      <div className="cyber-panel-title">
        <span className="cyber-spark">▪</span>เปลี่ยนรหัสผ่านของฉัน
      </div>
      <form
        className="cyber-panel-body tenant-users"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          void (async () => {
            try {
              if (password !== confirm) throw Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
              await request('/password', 'POST', { currentPassword, password });
              await fetch(apiPath('/api/auth/logout'), { method: 'POST' });
              window.location.assign(apiPath('/login'));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
              setBusy(false);
            }
          })();
        }}
      >
        <p>เมื่อบันทึกแล้ว ทุกอุปกรณ์ต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>
        <div className="tenant-user-fields">
          <label>
            รหัสผ่านเดิม
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>
            รหัสผ่านใหม่
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label>
            ยืนยันรหัสผ่านใหม่
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={busy}
            />
          </label>
        </div>
        {error && (
          <p className="cyber-account-error" role="alert">
            {error}
          </p>
        )}
        <button className="cyber-btn pink" disabled={busy}>
          {busy ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </form>
    </section>
  );
}
