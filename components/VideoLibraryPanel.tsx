'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import {
  maxLibraryBytes,
  maxLibraryVideos,
  maxVideoBytes,
  type StoredVideo,
  uploadMp4,
} from '@/lib/video-upload';
import { apiPath } from '@/lib/base-path';
import { confirmDialog } from '@/lib/confirm';
import VideoPreviewModal from './VideoPreviewModal';

function sizeLabel(bytes: number) {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function VideoLibraryPanel({
  accounts,
}: {
  accounts: { id: string; alias: string; verifiedHandle?: string | null; owner?: string }[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const accountId = accounts.some((account) => account.id === selectedAccountId)
    ? selectedAccountId
    : '';
  const selectedChannel = accounts.find((account) => account.id === accountId);
  const activeChannel = useRef(accountId);
  activeChannel.current = accountId;
  const query = '?accountId=' + encodeURIComponent(accountId);
  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [unassigned, setUnassigned] = useState<StoredVideo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | 'assign' | 'prepare' | ''>('');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<StoredVideo | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const [response, legacyResponse] = await Promise.all([
          fetch(apiPath('/api/live/videos' + (accountId ? query : '?scope=all')), {
            cache: 'no-store',
          }),
          accountId
            ? fetch(
                apiPath(
                  '/api/live/videos?accountId=' + encodeURIComponent(accountId) + '&unassigned=1',
                ),
                { cache: 'no-store' },
              )
            : null,
        ]);
        if (!response.ok || (legacyResponse && !legacyResponse.ok))
          throw new Error('โหลดคลังวิดีโอไม่สำเร็จ');
        const result: unknown = await response.json();
        const legacy = legacyResponse ? await legacyResponse.json() : { items: [] };
        if (
          !result ||
          typeof result !== 'object' ||
          !('items' in result) ||
          !Array.isArray(result.items)
        ) {
          throw new Error('อ่านข้อมูลคลังวิดีโอไม่สำเร็จ');
        }
        if (activeChannel.current !== accountId) return;
        setVideos(result.items as StoredVideo[]);
        setUnassigned(Array.isArray(legacy.items) ? legacy.items : []);
      } catch (caught) {
        if (activeChannel.current === accountId)
          setError(caught instanceof Error ? caught.message : 'โหลดคลังวิดีโอไม่สำเร็จ');
      } finally {
        if (activeChannel.current === accountId) setLoading(false);
      }
    },
    [accountId, query],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasConverting = videos.some((video) => video.status === 'converting');
  useEffect(() => {
    if (!hasConverting) return;
    const timer = setInterval(() => void refresh(true), 15000);
    return () => clearInterval(timer);
  }, [hasConverting, refresh]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || !accountId) return;
    if (!/\.(mp4|mov)$/i.test(file.name) || file.size < 1 || file.size > maxVideoBytes) {
      setError('เลือกไฟล์ MP4 / MOV ขนาดไม่เกิน 8 GB');
      return;
    }
    const used = videos.reduce((sum, video) => sum + video.sizeBytes, 0);
    if (videos.length >= maxLibraryVideos || used + file.size > maxLibraryBytes) {
      setError('โควตา 60 GB / 100 ไฟล์เต็ม หรือพื้นที่ว่างของระบบไม่พอ');
      return;
    }
    setBusy('upload');
    setProgress(0);
    setError('');
    setNotice('');
    try {
      const item = await uploadMp4(file, setProgress, accountId);
      setVideos((current) => [item, ...current]);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setNotice(
        item.status === 'converting'
          ? 'อัปโหลดสำเร็จ ระบบกำลังแปลงไฟล์เป็น H.264/AAC อยู่เบื้องหลัง (อาจนานหลายชั่วโมงสำหรับไฟล์ใหญ่) ปิดหน้านี้ได้ และใช้ไลฟ์ได้เมื่อแปลงเสร็จ'
          : 'วิดีโอพร้อมใช้งานแล้ว ระบบจะส่งสตรีมโดยไม่แปลงไฟล์ซ้ำ',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'อัปโหลดวิดีโอไม่สำเร็จ');
    } finally {
      setBusy('');
      setProgress(null);
    }
  }

  async function remove(video: StoredVideo) {
    if (busy || !(await confirmDialog(`ลบ ${video.name} ออกจากคลังวิดีโอ?`))) return;
    setBusy('delete');
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        apiPath(
          `/api/live/videos/${encodeURIComponent(video.id)}?${new URLSearchParams({ ...(video.accountId ? { accountId: video.accountId } : {}), ...(video.owner ? { owner: video.owner } : {}) })}`,
        ),
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? 'วิดีโอนี้กำลังถูกใช้ใน Live Session กรุณาเปลี่ยนวิดีโอก่อนลบ'
            : 'ลบวิดีโอไม่สำเร็จ',
        );
      }
      setVideos((current) => current.filter((item) => item.id !== video.id));
      setNotice('ลบวิดีโอแล้ว');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ลบวิดีโอไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function prepare(video: StoredVideo) {
    if (busy) return;
    setBusy('prepare');
    setError('');
    setNotice('');
    try {
      const params = new URLSearchParams({
        ...(video.accountId ? { accountId: video.accountId } : {}),
        ...(video.owner ? { owner: video.owner } : {}),
      });
      const response = await fetch(
        apiPath(`/api/live/videos/${encodeURIComponent(video.id)}/prepare?${params}`),
        { method: 'POST' },
      );
      const data = await response.json();
      if (!response.ok || !data.item) throw Error(data.error ?? 'เตรียมคลิปไม่สำเร็จ');
      const item: StoredVideo = { ...data.item, ...(video.owner ? { owner: video.owner } : {}) };
      setVideos((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
      setNotice(
        item.id === video.id
          ? 'คลิปนี้ผ่านการตรวจรูปแบบสำหรับ LIVE แล้ว ใช้ไฟล์เดิมได้'
          : 'กำลังเตรียมสำเนา .live30.mp4 เป็น 30 fps ปิดหน้านี้ได้ ต้นฉบับยังอยู่ เมื่อเสร็จแล้วเลือกสำเนาใหม่นี้ในตั้งค่าไลฟ์',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'เตรียมคลิปไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  const usedBytes = videos.reduce((sum, video) => sum + video.sizeBytes, 0);
  async function assign(video: StoredVideo) {
    if (busy || !accountId) return;
    setBusy('assign');
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        apiPath(`/api/live/videos/${encodeURIComponent(video.id)}/channel${query}`),
        { method: 'PUT' },
      );
      if (!response.ok) throw Error('ผูกคลิปไม่สำเร็จ คลิปอาจถูกใช้อยู่กับช่องอื่น');
      await refresh();
      setNotice('เพิ่มคลิปให้ช่องที่เลือกแล้ว');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <section className="cyber-panel">
        <div className="cyber-panel-title">คลังวิดีโอแยกตามช่อง</div>
        <div className="cyber-live-section">
          <label>
            ช่อง TikTok
            <select
              value={accountId}
              disabled={busy !== ''}
              onChange={(event) => {
                setSelectedAccountId(event.target.value);
                setVideos([]);
                setUnassigned([]);
                setPreview(null);
                setNotice('');
                setError('');
                setFile(null);
                if (fileInput.current) fileInput.current.value = '';
              }}
            >
              <option value="">ทั้งหมด</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.alias}
                  {account.verifiedHandle
                    ? ' (@' + account.verifiedHandle.replace(/^@/, '') + ')'
                    : ''}
                  {account.owner ? ' · ' + account.owner : ''}
                </option>
              ))}
            </select>
          </label>
          <p>
            {accountId
              ? 'แสดงเฉพาะคลิปของช่องที่เลือก'
              : 'แสดงคลิปทั้งหมดที่คุณมีสิทธิ์ดู รวมคลิปที่ยังไม่ผูกช่อง'}{' '}
            · เลือกช่องก่อนอัปโหลดหรือผูกคลิป
          </p>
        </div>
      </section>
      <section className="cyber-panel">
        <div className="cyber-panel-title">
          <span className="cyber-spark">▪</span> อัปโหลด MP4 / MOV
        </div>
        <div className="cyber-live-section">
          <p>
            สูงสุด 8 GB ต่อไฟล์ · คลังรวม 60 GB ต่อผู้ใช้ · ไม่เกิน 100 ไฟล์ · ระบบแปลงเป็น
            H.264/AAC 30 fps และภาพหลักทุก 2 วินาทีเมื่อจำเป็น ก่อนใช้ LIVE
          </p>
          <p>
            พื้นที่ดิสก์ใช้ร่วมกัน ระบบกันพื้นที่ 20 GB และพื้นที่แปลงไฟล์อีก 8 GB ก่อนรับไฟล์ใหม่
          </p>
          <form className="cyber-live-form" onSubmit={upload}>
            <label>
              เลือกไฟล์จากเครื่อง
              <input
                ref={fileInput}
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov,.MOV"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={busy !== '' || !accountId}
              />
            </label>
            <button
              className="cyber-btn cyan"
              type="submit"
              disabled={!file || busy !== '' || !accountId}
            >
              <Upload size={13} /> {busy === 'upload' ? 'กำลังอัปโหลด…' : 'อัปโหลด MP4 / MOV'}
            </button>
          </form>
          {busy === 'upload' && progress !== null && (
            <div role="status">
              {progress < 100
                ? `กำลังอัปโหลด ${progress}%`
                : 'อัปโหลดครบแล้ว กำลังตรวจและแปลงวิดีโอเป็น H.264/AAC อาจใช้เวลาหลายนาที อย่าปิดหน้านี้'}
              <progress value={progress} max={100} style={{ display: 'block', width: '100%' }} />
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </div>
      </section>
      <section className="cyber-panel">
        <div className="cyber-panel-title">
          <span className="cyber-spark">▪</span>{' '}
          {accountId ? 'วิดีโอของ ' + selectedChannel?.alias : 'วิดีโอทั้งหมด'}
          <span className="cyber-panel-action">
            <button
              className="cyber-btn"
              type="button"
              onClick={() => void refresh()}
              disabled={loading || busy !== ''}
            >
              <RefreshCw size={13} /> รีเฟรช
            </button>
          </span>
        </div>
        <div className="cyber-live-section">
          <p>
            {accountId ? 'ช่องนี้' : 'รวม'} {videos.length} ไฟล์ · {sizeLabel(usedBytes)}
            {accountId && ' · โควตารวมทุกช่องต่อผู้ใช้ 100 ไฟล์ / 60 GB'}
          </p>
          {loading ? (
            <p>กำลังโหลดคลังวิดีโอ…</p>
          ) : videos.length === 0 ? (
            <p>
              {accountId
                ? 'ยังไม่มีวิดีโอของช่องนี้ เลือกไฟล์เพื่ออัปโหลดให้ช่องนี้ได้เลย'
                : 'ยังไม่มีวิดีโอในคลัง เลือกช่องด้านบนเพื่ออัปโหลด'}
            </p>
          ) : (
            <div className="cyber-live-video-list">
              {videos.map((video) => (
                <div key={video.id}>
                  <span>
                    {video.name} · {sizeLabel(video.sizeBytes)}
                    {!accountId && (
                      <small style={{ display: 'block' }}>
                        {accounts.find((account) => account.id === video.accountId)?.alias ??
                          'ยังไม่ผูกช่อง'}
                        {video.owner ? ' · ' + video.owner : ''}
                      </small>
                    )}
                    {video.status === 'converting' && ' · กำลังแปลงไฟล์ (ยังใช้ไลฟ์ไม่ได้)'}
                    {video.status === 'failed' && ' · แปลงไม่สำเร็จ ลองเตรียมอีกครั้งได้'}
                  </span>
                  <span style={{ display: 'flex', gap: 8 }}>
                    {video.status !== 'converting' && (
                      <button
                        className="cyber-btn"
                        type="button"
                        disabled={busy !== ''}
                        onClick={() => void prepare(video)}
                      >
                        {video.status === 'failed' ? 'ลองเตรียมใหม่' : 'เตรียมสำหรับ LIVE'}
                      </button>
                    )}
                    {(!video.status || video.status === 'ready') && (
                      <button
                        className="cyber-btn cyan"
                        type="button"
                        onClick={() => setPreview(video)}
                      >
                        ▶ ดู
                      </button>
                    )}
                    <button
                      className="cyber-btn danger"
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => void remove(video)}
                    >
                      ลบ
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {unassigned.length > 0 && (
        <section className="cyber-panel">
          <div className="cyber-panel-title">คลิปเดิมที่ยังไม่ผูกช่อง</div>
          <div className="cyber-live-section">
            <p>
              คลิปเหล่านี้ยังไม่แสดงในช่องใด
              เลือกช่องด้านบนแล้วเพิ่มคลิปให้ช่องนั้นได้โดยไม่ต้องอัปโหลดใหม่
            </p>
            <div className="cyber-live-video-list">
              {unassigned.map((video) => (
                <div key={video.id}>
                  <span>
                    {video.name} · {sizeLabel(video.sizeBytes)}
                  </span>
                  <button
                    className="cyber-btn cyan"
                    disabled={busy !== ''}
                    onClick={() => void assign(video)}
                  >
                    เพิ่มให้ {selectedChannel?.alias}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {preview && (
        <VideoPreviewModal
          video={preview}
          accountId={preview.accountId ?? undefined}
          owner={preview.owner}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
