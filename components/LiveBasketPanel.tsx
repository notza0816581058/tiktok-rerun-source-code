'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/base-path';

type Product = {
  id: string;
  title: string;
  image: string | null;
  price: string | null;
  commission: string | null;
  shop: string | null;
  originalPrice?: string | null;
  stock?: number | null;
  live?: boolean | null;
  labels?: string[];
  demoRequests?: number | null;
};
type ProductSet = { id: string; title: string; count: number };
type Tab = 'showcase' | 'cart' | 'link' | 'sets';
type Outcome = 'accepted' | 'rejected' | 'unverified';

const tabs: [Tab, string][] = [
  ['showcase', 'โชว์เคส'],
  ['cart', 'ตะกร้าปัจจุบัน'],
  ['link', '+ เพิ่มจากลิงก์'],
  ['sets', 'ชุดจาก TikTok'],
];
const MAX = 20;
// Shop's own short stock format: 1344 -> 1.3K, 516712 -> 516.7K.
const compact = (n: number) =>
  n >= 1_000_000 ? `${Number((n / 1_000_000).toFixed(1))}M` : n >= 1000 ? `${Number((n / 1000).toFixed(1))}K` : String(n);
const blocked = (p: Product) => p.live === false;

function Labels({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null;
  return (
    <span className="live-basket-labels">
      <span className="live-basket-label">{labels[0]}</span>
      {labels.length > 1 && <span className="live-basket-label more">+{labels.length - 1}</span>}
    </span>
  );
}

/** The account's LIVE basket, read and changed through its own TikTok Shop session. */
export default function LiveBasketPanel({
  accountId,
  accountName,
  handle,
}: {
  accountId: string;
  accountName: string;
  handle?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('showcase');
  // Product lists by source: showcase, cart, link (checked links) and set:<id>.
  const [lists, setLists] = useState<Record<string, Product[]>>({});
  const [sets, setSets] = useState<ProductSet[] | null>(null);
  const [openSet, setOpenSet] = useState<ProductSet | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [links, setLinks] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const path = apiPath(`/api/live/sessions/${encodeURIComponent(accountId)}/basket`);

  async function request(init?: { query?: string; body?: unknown }) {
    const response = await fetch(init?.body ? path : `${path}?${init?.query}`, {
      cache: 'no-store',
      ...(init?.body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }
        : {}),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'ติดต่อ TikTok ไม่สำเร็จ');
    return data;
  }

  async function load(key: string, query: string) {
    setBusy('load');
    setError('');
    try {
      const data = await request({ query });
      if (data.sets) setSets(data.sets);
      else {
        setLists((current) => ({ ...current, [key]: data.products }));
        if (key === 'cart') setPinnedId(data.pinnedId);
      }
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดจาก TikTok ไม่สำเร็จ');
      return null;
    } finally {
      setBusy('');
    }
  }

  // Open on the showcase like the Shop page does; other tabs load when first opened.
  useEffect(() => {
    void load('showcase', 'view=showcase');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  /** Move one cart product to a 0-based position; TikTok confirms by the order read back. */
  async function move(id: string, index: number) {
    setBusy('move');
    setMessage('');
    setError('');
    try {
      const data = await request({ body: { action: 'move', productIds: [id], index } });
      const outcome = (data.outcomes as Record<string, Outcome>)[id];
      setMessage(
        outcome === 'accepted'
          ? `ย้ายไปลำดับที่ ${index + 1} แล้ว · TikTok ยืนยันแล้ว`
          : outcome === 'rejected'
            ? 'TikTok ไม่รับการย้ายลำดับ'
            : 'ยังยืนยันลำดับใหม่ไม่ได้ ตรวจใน TikTok Shop ก่อนกดซ้ำ',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ย้ายลำดับไม่สำเร็จ');
    } finally {
      setBusy('');
    }
    await load('cart', 'view=cart');
  }

  /** Add/remove/pin; adds go in batches of 20 because one Shop write takes at most 20. */
  async function change(action: 'add' | 'remove' | 'pin', ids: string[]) {
    setBusy(action);
    setMessage('');
    setError('');
    const all: Outcome[] = [];
    try {
      for (let i = 0; i < ids.length; i += MAX) {
        const data = await request({ body: { action, productIds: ids.slice(i, i + MAX) } });
        all.push(...(Object.values(data.outcomes) as Outcome[]));
      }
      const done = all.filter((x) => x === 'accepted').length;
      const rejected = all.filter((x) => x === 'rejected').length;
      const unknown = all.length - done - rejected;
      const word = action === 'add' ? 'เพิ่ม' : action === 'remove' ? 'ลบ' : 'ปักหมุด';
      setMessage(
        `${word}สำเร็จ ${done}/${all.length} รายการ` +
          (rejected ? ` · TikTok ปฏิเสธ ${rejected}` : '') +
          (unknown ? ` · ยังยืนยันไม่ได้ ${unknown} (ตรวจใน TikTok Shop ก่อนกดซ้ำ)` : '') +
          (done === all.length ? ' · TikTok ยืนยันแล้ว' : ''),
      );
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แก้ตะกร้าไม่สำเร็จ');
    } finally {
      setBusy('');
    }
    await load('cart', 'view=cart');
  }

  async function checkLinks() {
    const urls = links
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    setBusy('preview');
    setError('');
    setMessage('');
    try {
      const data = await request({ body: { action: 'preview', links: urls } });
      setLists((current) => ({ ...current, link: data.products }));
      setSelected(new Set((data.products as Product[]).map((p) => p.id).slice(0, MAX)));
      if (!data.products.length) setMessage('ไม่พบสินค้าจากลิงก์ที่วาง');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ค้นหาสินค้าจากลิงก์ไม่สำเร็จ');
    } finally {
      setBusy('');
    }
  }

  async function showSet(set: ProductSet, use: boolean) {
    setOpenSet(set);
    const data = lists[`set:${set.id}`] ? { products: lists[`set:${set.id}`] } : await load(`set:${set.id}`, `view=set&setId=${set.id}`);
    const ids = ((data?.products ?? []) as Product[]).map((p) => p.id);
    setSelected(new Set(ids));
    if (use && ids.length) await change('add', ids);
  }

  function open(next: Tab) {
    setTab(next);
    setSelected(new Set());
    setMessage('');
    setOpenSet(null);
    if (busy) return;
    if ((next === 'showcase' || next === 'cart') && !lists[next]) void load(next, `view=${next}`);
    if (next === 'sets' && !sets) void load('sets', 'view=sets');
  }

  const key = tab === 'sets' ? (openSet ? `set:${openSet.id}` : null) : tab;
  const all = key ? (lists[key] ?? []) : [];
  const query = search.trim().toLowerCase();
  const shown = all.filter(
    (p) => !query || `${p.title} ${p.id} ${p.shop ?? ''}`.toLowerCase().includes(query) || query.includes(p.id),
  );
  const selectable = shown.filter((p) => !blocked(p));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (tab === 'sets' || next.size < MAX) next.add(id);
      return next;
    });
  const showList = tab !== 'sets' || openSet;
  const label = tab === 'cart' ? 'ตะกร้าปัจจุบัน' : tab === 'link' ? 'สินค้าจากลิงก์' : openSet ? `ชุด ${openSet.title}` : 'โชว์เคส';

  return (
    <section className="live-basket">
      <p className="live-basket-account">
        <strong>
          บัญชี TikTok ที่จัดการ: {accountName}
          {handle ? ` (@${handle.replace(/^@/, '')})` : ''}
        </strong>
        <br />
        <small>เพิ่มและลบเฉพาะตะกร้าไลฟ์ของบัญชีนี้ · ใช้ session ของบัญชีนี้ ไม่ใช่บัญชีที่เปิดในเบราว์เซอร์</small>
      </p>

      <div className="live-basket-tabs" role="tablist" aria-label="ตะกร้า LIVE">
        {tabs.map(([name, text]) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={tab === name ? 'active' : ''}
            disabled={!!busy}
            onClick={() => open(name)}
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          disabled={!!busy || tab === 'link'}
          onClick={() =>
            tab === 'sets'
              ? openSet
                ? void load(`set:${openSet.id}`, `view=set&setId=${openSet.id}`)
                : void load('sets', 'view=sets')
              : void load(tab, `view=${tab}`)
          }
        >
          ↻ รีเฟรช
        </button>
      </div>

      {tab === 'link' && (
        <label className="live-basket-links">
          วางลิงก์สินค้า TikTok Shop บรรทัดละลิงก์ (สูงสุด {MAX}) · ลิงก์ย่อ vt.tiktok.com ก็ได้
          <textarea
            rows={4}
            value={links}
            placeholder="https://shop.tiktok.com/view/product/..."
            onChange={(e) => setLinks(e.target.value)}
          />
          <button type="button" className="live-basket-secondary" disabled={!!busy || !links.trim()} onClick={() => void checkLinks()}>
            {busy === 'preview' ? 'กำลังค้นหาใน TikTok…' : 'ค้นหาสินค้าจากลิงก์'}
          </button>
        </label>
      )}

      {tab === 'sets' && !openSet && (
        <>
          <p className="live-basket-count">
            {busy === 'load' ? 'กำลังโหลดชุดจาก TikTok…' : sets ? `ชุดสินค้า LIVE ${sets.length} ชุด` : ''}
          </p>
          <ul className="live-basket-list">
            {sets && !sets.length && <li className="live-basket-empty">ยังไม่มีชุดสินค้า LIVE ใน TikTok Shop</li>}
            {sets?.map((set) => (
              <li key={set.id}>
                <div className="live-basket-set">
                  <span className="live-basket-info">
                    <strong>{set.title}</strong>
                    <small>{set.count} รายการ</small>
                  </span>
                  <button type="button" className="live-basket-primary" disabled={!!busy} onClick={() => void showSet(set, true)}>
                    ใช้ชุดนี้
                  </button>
                  <button type="button" className="live-basket-secondary" disabled={!!busy} onClick={() => void showSet(set, false)}>
                    ดูสินค้าในชุด
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {showList && (tab !== 'link' || lists.link) && (
        <>
          {tab === 'sets' && (
            <button type="button" className="live-basket-back" disabled={!!busy} onClick={() => setOpenSet(null)}>
              ← กลับไปรายการชุด
            </button>
          )}
          <div className="live-basket-search">
            <input
              value={search}
              placeholder="🔍 ค้นหาชื่อ รหัสสินค้า หรือวางลิงก์ TikTok…"
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              disabled={!selectable.length}
              onClick={() =>
                setSelected(new Set(selectable.slice(0, tab === 'sets' ? selectable.length : MAX).map((p) => p.id)))
              }
            >
              เลือกที่แสดงทั้งหมด
            </button>
            <button type="button" disabled={!selected.size} onClick={() => setSelected(new Set())}>
              ล้างที่เลือก
            </button>
          </div>
          <p className="live-basket-count">
            {busy === 'load' ? 'กำลังโหลดจาก TikTok… (10–40 วินาที)' : lists[key ?? ''] ? `${label} ${shown.length} / ${all.length} รายการ` : ''}
          </p>
          {lists[key ?? ''] && !shown.length && busy !== 'load' && <p className="live-basket-empty">ไม่พบสินค้า</p>}

          {tab === 'showcase' && (
            <>
              <p className="live-basket-info-banner">ⓘ เพิ่มเข้าไลฟ์ได้เฉพาะสินค้าสถานะ Live</p>
              <div className="live-basket-table" role="table">
                <div className="live-basket-thead" role="row">
                  <span role="columnheader">
                    <input
                      type="checkbox"
                      aria-label="เลือกที่แสดงทั้งหมด"
                      checked={!!selectable.length && selectable.slice(0, MAX).every((p) => selected.has(p.id))}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(selectable.slice(0, MAX).map((p) => p.id)) : new Set())
                      }
                    />
                  </span>
                  <span role="columnheader">สินค้า</span>
                  <span role="columnheader">ราคา</span>
                  <span role="columnheader">ค่าคอม</span>
                  <span role="columnheader">สต็อก</span>
                  <span role="columnheader">สถานะ</span>
                </div>
                {shown.map((p) => (
                  <label key={p.id} role="row" className={`live-basket-trow${selected.has(p.id) ? ' selected' : ''}${blocked(p) ? ' blocked' : ''}`}>
                    <span role="cell">
                      <input type="checkbox" disabled={blocked(p)} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    </span>
                    <span role="cell" className="live-basket-product">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" width={48} height={48} loading="lazy" />
                      ) : (
                        <span className="live-basket-noimage" aria-hidden />
                      )}
                      <span className="live-basket-info">
                        <strong className="clamp">{p.title}</strong>
                        <Labels labels={p.labels} />
                        <small>ID:{p.id}</small>
                        {p.shop && <small>{p.shop}</small>}
                      </span>
                    </span>
                    <span role="cell">{p.price ?? '-'}</span>
                    <span role="cell">{p.commission?.split(' · ')[0] ?? '-'}</span>
                    <span role="cell">
                      {p.stock === null || p.stock === undefined ? (
                        '-'
                      ) : p.stock > 0 ? (
                        <span className="live-basket-stock in">
                          ● In stock
                          <br />({compact(p.stock)})
                        </span>
                      ) : (
                        <span className="live-basket-stock out">● Sold out</span>
                      )}
                    </span>
                    <span role="cell">
                      {p.live === null || p.live === undefined ? (
                        '-'
                      ) : (
                        <span className={`live-basket-status ${p.live ? 'live' : 'off'}`}>{p.live ? 'Live' : 'Unavailable'}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {tab === 'cart' && (
            <ul className="live-basket-cart">
              {shown.map((p, index) => (
                <li key={p.id} className={selected.has(p.id) ? 'selected' : ''}>
                  <span className="live-basket-index">{index + 1}</span>
                  <input type="checkbox" aria-label={`เลือก ${p.title}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" width={64} height={64} loading="lazy" />
                  ) : (
                    <span className="live-basket-noimage" aria-hidden />
                  )}
                  <span className="live-basket-info">
                    <strong className="clamp">{p.title}</strong>
                    <Labels labels={p.labels} />
                    <span>
                      <b className="live-basket-price">{p.price ?? '-'}</b>
                      {p.originalPrice && <s className="live-basket-origin"> {p.originalPrice}</s>}
                      {p.id === pinnedId && <span className="live-basket-pinned"> 📌 ปักหมุดอยู่</span>}
                    </span>
                    <small>
                      {p.stock !== null && p.stock !== undefined ? `คงเหลือ: ${p.stock.toLocaleString('th-TH')} · ` : ''}
                      {p.demoRequests !== null && p.demoRequests !== undefined ? `ขอดูเดโม: ${p.demoRequests} · ` : ''}
                      ID:{p.id}
                    </small>
                    {p.commission && <span className="live-basket-commission">ค่าคอม {p.commission}</span>}
                  </span>
                  {!query && (
                    <span className="live-basket-row-actions vertical" aria-label="ย้ายลำดับ">
                      <button type="button" title="ขึ้นบนสุด" aria-label="ขึ้นบนสุด" disabled={!!busy || index === 0} onClick={() => void move(p.id, 0)}>
                        ⤒
                      </button>
                      <button type="button" title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น" disabled={!!busy || index === 0} onClick={() => void move(p.id, index - 1)}>
                        ▲
                      </button>
                      <button type="button" title="เลื่อนลง" aria-label="เลื่อนลง" disabled={!!busy || index === shown.length - 1} onClick={() => void move(p.id, index + 1)}>
                        ▼
                      </button>
                    </span>
                  )}
                  <span className="live-basket-row-actions vertical">
                    <button type="button" title="ปักหมุด" aria-label="ปักหมุด" disabled={!!busy || p.id === pinnedId} onClick={() => void change('pin', [p.id])}>
                      📌
                    </button>
                    <button type="button" title="ลบออกจากตะกร้า" aria-label="ลบออกจากตะกร้า" className="danger" disabled={!!busy} onClick={() => void change('remove', [p.id])}>
                      🗑
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {(tab === 'link' || tab === 'sets') && (
            <ul className="live-basket-list">
              {shown.map((p) => (
                <li key={p.id} className={selected.has(p.id) ? 'selected' : ''}>
                  <label>
                    <input type="checkbox" disabled={blocked(p)} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" width={56} height={56} loading="lazy" />
                    ) : (
                      <span className="live-basket-noimage" aria-hidden />
                    )}
                    <span className="live-basket-info">
                      <strong>{p.title}</strong>
                      <small>
                        {p.price ? `${p.price} · ` : ''}
                        {p.id}
                      </small>
                      {p.commission && <span className="live-basket-commission">ค่าคอม {p.commission}</span>}
                      {p.shop && <small>{p.shop}</small>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="live-basket-note">ผลที่แสดงมาจากที่ TikTok ตอบกลับ ไม่ใช่การยืนยันยอดขาย · ปักหมุดได้เมื่อกำลัง LIVE</p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <div className="live-basket-footer">
        <span>{selected.size ? `เลือกแล้ว ${selected.size} รายการ` : 'ยังไม่ได้เลือกสินค้า'}</span>
        {showList && (
          <button
            type="button"
            className="live-basket-primary"
            disabled={!!busy || !selected.size}
            onClick={() => void change(tab === 'cart' ? 'remove' : 'add', [...selected])}
          >
            {busy === 'add' || busy === 'remove'
              ? 'กำลังส่งไป TikTok…'
              : tab === 'cart'
                ? 'ลบที่เลือกออกจากตะกร้า'
                : 'เพิ่มที่เลือกเข้าตะกร้า'}
          </button>
        )}
      </div>
    </section>
  );
}
