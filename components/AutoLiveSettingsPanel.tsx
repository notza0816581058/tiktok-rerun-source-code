'use client';

import React, { useEffect, useState, type MutableRefObject } from 'react';
import { apiPath } from '@/lib/base-path';
import LiveRoundSettings, { type RoundSettings } from './LiveRoundSettings';

type Settings = RoundSettings & {
  endAfterMinutes: number | null;
  restartAfterMinutes: number | null;
  dailyStartTime: string | null;
  recoverStream: boolean;
  closedRoomAction: 'new_room' | 'stop';
  gmvTarget: number | null;
  gmvWithinMinutes: number | null;
};
const defaults: Settings = {
  endAfterMinutes: null,
  restartAfterMinutes: null,
  dailyStartTime: null,
  recoverStream: false,
  closedRoomAction: 'stop',
  gmvTarget: null,
  gmvWithinMinutes: null,
  videoRotation: [],
  productSetRotation: [],
  autoAddProducts: true,
  autoPinProduct: false,
  productPinSelections: {},
};

export function AutoRunNotice({ phase, error }: { phase: string; error: string | null }) {
  if (!error) return null;
  if (phase === 'idle')
    return (
      <details className="cyber-auto-run-history">
        <summary>ผลการทำงาน AUTO ครั้งก่อน — มีข้อความแจ้งเตือน</summary>
        <p>{error}</p>
        <p>นี่คือผลของรอบไลฟ์ครั้งก่อน ไม่ใช่ผลการบันทึกการตั้งค่า และยังไม่ได้ทดสอบรอบใหม่</p>
      </details>
    );
  return <p role="alert">ผลการทำงาน AUTO ล่าสุด: {error}</p>;
}

function DurationFields({
  label,
  totalMinutes,
  onChange,
}: {
  label: string;
  totalMinutes: number;
  onChange: (minutes: number) => void;
}) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return (
    <div className="cyber-auto-duration">
      <span>{label}</span>
      <div className="cyber-auto-duration-fields">
        <label>
          ชั่วโมง
          <input
            type="number"
            min={0}
            max={24}
            step={1}
            value={hours}
            onChange={(event) => {
              const nextHours = Math.max(
                0,
                Math.min(24, Math.trunc(Number(event.target.value) || 0)),
              );
              onChange(Math.min(1440, nextHours * 60 + minutes));
            }}
          />
        </label>
        <label>
          นาที
          <input
            type="number"
            min={0}
            max={hours === 24 ? 0 : 59}
            step={1}
            value={minutes}
            onChange={(event) => {
              const nextMinutes = Math.max(
                0,
                Math.min(59, Math.trunc(Number(event.target.value) || 0)),
              );
              onChange(Math.min(1440, hours * 60 + nextMinutes));
            }}
          />
        </label>
      </div>
    </div>
  );
}

export default function AutoLiveSettingsPanel({
  accountId,
  owner,
  saveRef,
}: {
  accountId: string;
  owner?: string;
  saveRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [savedSettings, setSavedSettings] = useState<Settings | null>(null);
  const [phase, setPhase] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [lastRunError, setLastRunError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const path = apiPath(`/api/live/sessions/${encodeURIComponent(accountId)}/auto-settings`);

  useEffect(() => {
    let active = true;
    fetch(path, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('โหลดโหมด AUTO ไม่สำเร็จ');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setSettings({ ...defaults, ...data.item.settings });
        setSavedSettings({ ...defaults, ...data.item.settings });
        setCompleted(data.item.completedRounds ?? 0);
        setPhase(data.item.phase);
        setLastRunError(data.item.lastError ?? null);
        setMessage('');
      })
      .catch(() => active && setMessage('โหลดโหมด AUTO ไม่สำเร็จ'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path]);

  const change = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = save;
    return () => {
      saveRef.current = null;
    };
  });
  async function save() {
    if (loading || saving) {
      setMessage('กรุณารอโหลดหรือบันทึกค่า AUTO ให้เสร็จก่อน');
      return false;
    }
    if (savedSettings && JSON.stringify(settings) === JSON.stringify(savedSettings)) {
      setMessage('ค่าปัจจุบันบันทึกไว้แล้ว');
      return true;
    }
    if (settings.restartAfterMinutes !== null && settings.endAfterMinutes === null) {
      setMessage('เปิดลงไลฟ์เมื่อครบเวลาก่อนเปิดพักแล้วเริ่มใหม่');
      return false;
    }
    if (
      [settings.endAfterMinutes, settings.restartAfterMinutes].some(
        (value) => value !== null && (!Number.isInteger(value) || value < 1 || value > 1440),
      )
    ) {
      setMessage('ระยะเวลาต้องมากกว่า 0 นาที และไม่เกิน 24 ชั่วโมง');
      return false;
    }
    if (
      settings.gmvTarget !== null &&
      (!(settings.gmvTarget > 0) || !settings.gmvWithinMinutes || settings.gmvWithinMinutes > 1440)
    ) {
      setMessage('กฎ GMV: ใส่เป้ายอดมากกว่า 0 และเวลา 1 นาทีถึง 24 ชั่วโมง');
      return false;
    }
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ ตรวจเวลาและลองอีกครั้ง');
      setSettings(data.item.settings);
      setSavedSettings(data.item.settings);
      setCompleted(data.item.completedRounds ?? 0);
      setPhase(data.item.phase);
      setLastRunError(data.item.lastError ?? null);
      setMessage('บันทึกโหมด AUTO แล้ว');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cyber-stream-settings cyber-auto-settings">
      <strong>⏱ โหมดอัตโนมัติ — ไลฟ์ (AUTO)</strong>
      <p>สถานะ: {phase === 'live' ? 'กำลังทำงาน' : phase === 'resting' ? 'กำลังพัก' : 'รอเริ่ม'}</p>
      {loading ? (
        <p>กำลังโหลด…</p>
      ) : (
        <>
          <label className="cyber-auto-check">
            <input
              type="checkbox"
              checked={settings.endAfterMinutes !== null}
              onChange={(event) =>
                change({
                  endAfterMinutes: event.target.checked ? 10 : null,
                  ...(event.target.checked ? {} : { restartAfterMinutes: null }),
                })
              }
            />
            ⏬ ลงไลฟ์เองเมื่อออกอากาศครบเวลา
          </label>
          {settings.endAfterMinutes !== null && (
            <DurationFields
              label="ออกอากาศนาน"
              totalMinutes={settings.endAfterMinutes}
              onChange={(minutes) => change({ endAfterMinutes: minutes })}
            />
          )}
          <label className="cyber-auto-check">
            <input
              type="checkbox"
              checked={settings.restartAfterMinutes !== null}
              disabled={settings.endAfterMinutes === null}
              onChange={(event) =>
                change({ restartAfterMinutes: event.target.checked ? 30 : null })
              }
            />
            ⏫ พักครบเวลาแล้วเริ่มไลฟ์ใหม่
          </label>
          {settings.restartAfterMinutes !== null && (
            <DurationFields
              label="พักนาน"
              totalMinutes={settings.restartAfterMinutes}
              onChange={(minutes) => change({ restartAfterMinutes: minutes })}
            />
          )}
          <label className="cyber-auto-check">
            <input
              type="checkbox"
              checked={settings.dailyStartTime !== null}
              onChange={(event) =>
                change({ dailyStartTime: event.target.checked ? '17:00' : null })
              }
            />
            ⏰ เริ่มไลฟ์ทุกวันตามเวลาไทย
          </label>
          {settings.dailyStartTime !== null && (
            <label>
              เวลาเริ่ม (Asia/Bangkok)
              <input
                type="time"
                value={settings.dailyStartTime}
                onChange={(event) => change({ dailyStartTime: event.target.value })}
              />
            </label>
          )}
          <label className="cyber-auto-check">
            <input
              type="checkbox"
              checked={settings.recoverStream}
              onChange={(event) => change({ recoverStream: event.target.checked })}
            />
            🔄 สตรีมหลุดแล้วกู้ห้องเดิมสูงสุด 5 นาที
          </label>
          {settings.recoverStream && (
            <p>
              นับจากสัญญาณหลุดครั้งแรก ถ้ากู้ไม่สำเร็จภายใน 5 นาที จะสั่งปิดห้องและหยุดรอบนี้
              หากเชื่อมสำเร็จจะยกเลิกการนับเวลา
            </p>
          )}
          {settings.recoverStream && (
            <label>
              ถ้าห้องเดิมปิดไปแล้ว
              <select
                value={settings.closedRoomAction}
                onChange={(event) =>
                  change({ closedRoomAction: event.target.value as Settings['closedRoomAction'] })
                }
              >
                <option value="new_room">เปิดห้องใหม่อัตโนมัติ</option>
                <option value="stop">หยุดและรอคำสั่ง</option>
              </select>
            </label>
          )}
          <label className="cyber-auto-check">
            <input
              type="checkbox"
              checked={settings.gmvTarget !== null}
              onChange={(event) =>
                change(
                  event.target.checked
                    ? { gmvTarget: 1000, gmvWithinMinutes: 60 }
                    : { gmvTarget: null, gmvWithinMinutes: null },
                )
              }
            />
            📈 กฎ GMV — ยอดไม่ถึงเป้าในเวลาที่ตั้ง ให้ลงไลฟ์แล้วขึ้นรอบใหม่
          </label>
          {settings.gmvTarget !== null && (
            <>
              <label>
                เป้า GMV ต่อรอบ (บาท)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.gmvTarget}
                  onChange={(event) => change({ gmvTarget: Number(event.target.value) || 0 })}
                />
              </label>
              <DurationFields
                label="ภายใน"
                totalMinutes={settings.gmvWithinMinutes ?? 60}
                onChange={(minutes) => change({ gmvWithinMinutes: minutes })}
              />
              <p>
                อ่านยอดจากแหล่งข้อมูลยอดขายที่ผูกกับบัญชีนี้ (หน้ายอดขาย) นับเฉพาะยอดที่เพิ่มขึ้นในรอบนั้น
                ถ้าอ่านยอดไม่ได้ ระบบจะไม่ปิดห้อง
              </p>
            </>
          )}
          <LiveRoundSettings
            owner={owner}
            accountId={accountId}
            settings={settings}
            change={change}
            completed={completed}
          />
          <p>การเริ่มอัตโนมัติใช้ชื่อไลฟ์ของบัญชี และรายการต่อรอบที่บันทึกไว้ด้านบน</p>
          <button
            type="button"
            className="cyber-btn pink"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกโหมด AUTO'}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <AutoRunNotice phase={phase} error={lastRunError} />
    </div>
  );
}
