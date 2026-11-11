// Mock of the Live Hub API for the demo. It answers the same routes the UI calls, using the
// in-memory sample data in ./store. Nothing here talks to TikTok, TikTok Shop, an AI provider,
// LINE, a streaming server or a database: "start LIVE" only flips a status on screen.
import { db, salesFor, uuid, DEMO_ADMIN, type DemoAccount, type DemoVideo } from './store';

const DEMO_NOTE = 'เวอร์ชันตัวอย่าง: ฟังก์ชันนี้ไม่ได้เชื่อมต่อระบบจริง';
const headers = { 'Cache-Control': 'no-store' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
const fail = (error: string, status = 400) => json({ error }, status);
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const value = await req.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function account(id: string) {
  return db().accounts.find((a) => a.id === id);
}
function owned(user: string, ws: string) {
  return db().accounts.filter((a) => a.owner === ws || (user === DEMO_ADMIN && ws === '*'));
}
function publicAccount(a: DemoAccount, withOwner = false) {
  const { color: _color, owner, ...rest } = a;
  return withOwner ? { ...rest, owner } : rest;
}
function session(id: string) {
  const s = db().sessions[id];
  const video = db().videos.find((v) => v.id === s.videoId);
  return {
    accountId: id,
    status: s.status,
    videoId: s.videoId,
    videoName: video?.name ?? null,
    hasRtmpConfig: s.hasRtmpConfig,
    hasOpenRoom: s.status === 'live',
    startedAt: s.startedAt,
  };
}
function publicVideo(v: DemoVideo, withOwner = false) {
  const { owner, ...rest } = v;
  return withOwner ? { ...rest, owner } : rest;
}
function basketProduct(id: string) {
  const p = db().products.find((x) => x.id === id);
  return p ? { ...p, image: null, live: true, demoRequests: null } : null;
}
function productNames(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, db().products.find((p) => p.id === id)?.title ?? id]));
}
function productSet(id: string) {
  const s = db().sets.find((x) => x.id === id);
  return s && { ...s, roomId: '', productNames: productNames(s.productIds), hasCookie: true };
}
function autoState(id: string) {
  const a = db().auto[id];
  const set = a.settings.productSetRotation[0];
  return {
    settings: a.settings,
    phase: a.phase,
    phaseStartedAt: a.phaseStartedAt,
    lastError: null,
    completedRounds: a.completedRounds,
    activeRound: a.phase === 'live'
      ? { index: a.completedRounds % Math.max(1, a.settings.videoRotation.length), videoId: a.settings.videoRotation[0], productSetId: set, addProducts: a.settings.autoAddProducts, pinProduct: a.settings.autoPinProduct }
      : null,
    nextRound: { index: 0, addProducts: a.settings.autoAddProducts, pinProduct: a.settings.autoPinProduct },
    productsOutcome: a.phase === 'live' ? 'accepted' : 'none',
    pinOutcome: a.phase === 'live' && a.settings.autoPinProduct ? 'accepted' : 'none',
  };
}
function accountStatus(id: string) {
  const a = db().auto[id];
  const ai = db().ai[id];
  const autoSet = db().sets.find((s) => s.accountId === id && s.autoApply);
  const last = ai.history[0];
  return {
    accountId: id,
    hasOpenRoom: db().sessions[id].status === 'live',
    cart: null,
    autoSet: autoSet ? { name: autoSet.name, productCount: autoSet.productIds.length } : null,
    ai: {
      enabled: ai.settings.enabled,
      aiReady: ai.hasApiKey,
      chatConnected: ai.chatConnected,
      chatMessage: ai.chatConnected ? 'เชื่อมแชทแล้ว (ตัวอย่าง)' : 'ยังไม่ได้เชื่อมแชท',
      model: ai.settings.model,
      answerWhen: ai.settings.answerWhen,
      sentCount: ai.history.filter((h) => h.status === 'sent').length,
      lastReply: last ? { status: last.status, at: last.createdAt } : null,
    },
    auto: {
      phase: a.phase,
      phaseStartedAt: a.phaseStartedAt,
      completedRounds: a.completedRounds,
      lastError: null,
      endAfterMinutes: a.settings.endAfterMinutes,
      restartAfterMinutes: a.settings.restartAfterMinutes,
      dailyStartTime: a.settings.dailyStartTime,
      recoverStream: a.settings.recoverStream,
      autoAddProducts: a.settings.autoAddProducts,
      autoPinProduct: a.settings.autoPinProduct,
      videoCount: a.settings.videoRotation.length,
      setCount: a.settings.productSetRotation.length,
    },
  };
}
function sales(id: string) {
  const s = salesFor(id);
  return { ...s, updatedAt: now(), checkedAt: now(), liveRoomId: db().sessions[id]?.roomId ?? null };
}
const fakeRoomId = () => '73' + String(Date.now()).padStart(17, '0').slice(-17);

/** owner = the workspace the signed-in user is looking at. */
export async function handleDemoApi(req: Request, path: string[], user: string): Promise<Response> {
  const method = req.method;
  const url = new URL(req.url);
  const q = url.searchParams;
  const ws = db().workspace[user] ?? user;
  const [root, a1, a2, a3, a4] = path;
  const all = q.get('scope') === 'all' && user === DEMO_ADMIN;
  const mine = () => (all ? db().accounts : db().accounts.filter((a) => a.owner === ws));

  // ---- system ----------------------------------------------------------------------------
  if (root === 'system' && a1 === 'health')
    return json({ status: 'ready', service: 'demo', dependencies: { postgres: 'ready', redis: 'ready', worker: 'ready' } });

  // ---- accounts --------------------------------------------------------------------------
  if (root === 'accounts') {
    if (!a1 && method === 'GET') return json({ items: mine().map((a) => publicAccount(a, all)) });
    if (!a1 && method === 'POST') {
      const b = await body(req);
      const alias = String(b.alias ?? '').trim();
      if (!alias) return fail('กรุณาตั้งชื่อบัญชี');
      const handle = 'demo.new.' + Math.floor(Math.random() * 900 + 100);
      const item: DemoAccount = {
        id: uuid(), owner: ws, alias, liveTitle: String(b.liveTitle ?? ''), claimedHandle: handle, verifiedHandle: handle,
        verifiedAt: now(), verificationStatus: 'connected', probe: 'not_run', probeHttpStatus: null, createdAt: now(), color: '#a78bfa',
      };
      const d = db();
      d.accounts.push(item);
      d.sessions[item.id] = { accountId: item.id, status: 'idle', videoId: null, hasRtmpConfig: false, roomId: null, startedAt: null };
      d.auto[item.id] = { ...structuredClone(d.auto[d.accounts[1].id]), phase: 'idle', phaseStartedAt: null, completedRounds: 0 };
      d.auto[item.id].settings.dailyStartTime = null;
      d.ai[item.id] = { ...structuredClone(d.ai[d.accounts[1].id]), history: [] };
      d.carts[item.id] = { ids: [], pinnedId: null };
      return json({ item: publicAccount(item) }, 201);
    }
    const acc = a1 ? account(a1) : undefined;
    if (!acc) return fail('ไม่พบบัญชีนี้', 404);
    if (a2 === 'avatar') {
      const letter = [...acc.alias].find((c) => /\S/.test(c)) ?? '?';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#201e3d"/><circle cx="48" cy="48" r="40" fill="${acc.color}" opacity=".85"/><text x="48" y="60" font-size="36" font-family="sans-serif" text-anchor="middle" fill="#15142a">${letter}</text></svg>`;
      return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=600' } });
    }
    if (a2 === 'verify' && method === 'POST') {
      await sleep(400);
      acc.verifiedAt = now();
      return json({ item: publicAccount(acc) });
    }
    if (a2 === 'session' && method === 'POST') {
      acc.verificationStatus = 'connected';
      acc.verifiedHandle = acc.claimedHandle;
      acc.verifiedAt = now();
      return json({ item: publicAccount(acc) });
    }
    if (!a2 && method === 'PATCH') {
      const b = await body(req);
      acc.alias = String(b.alias ?? acc.alias);
      acc.liveTitle = String(b.liveTitle ?? acc.liveTitle);
      return json({ item: publicAccount(acc) });
    }
    if (!a2 && method === 'DELETE') {
      if (db().sessions[acc.id]?.status === 'live') return fail('หยุดไลฟ์ก่อนลบบัญชี', 409);
      db().accounts = db().accounts.filter((x) => x.id !== acc.id);
      return json({ ok: true });
    }
  }

  // ---- live ------------------------------------------------------------------------------
  if (root === 'live') {
    if (a1 === 'account-status') return json({ items: mine().map((a) => accountStatus(a.id)) });

    if (a1 === 'sessions' && !a2) return json({ items: mine().map((a) => session(a.id)) });
    if (a1 === 'sessions' && a2) {
      const id = a2;
      const s = db().sessions[id];
      if (!s) return fail('ไม่พบบัญชีหรือวิดีโอที่เลือก', 404);
      const action = a3;
      if (action === 'status') return json({ item: session(id) });
      if ((action === 'start' || action === 'start-auto' || action === 'auto-destination') && method === 'POST') {
        if (!s.videoId) return fail('เลือกวิดีโอก่อนเริ่มไลฟ์', 409);
        await sleep(900);
        s.status = 'live';
        s.startedAt = now();
        s.roomId = fakeRoomId();
        s.hasRtmpConfig = true;
        const auto = db().auto[id];
        auto.phase = 'live';
        auto.phaseStartedAt = now();
        const set = db().sets.find((x) => x.accountId === id && x.autoApply);
        if (set && auto.settings.autoAddProducts) db().carts[id] = { ids: [...set.productIds], pinnedId: null };
        return json({ item: session(id), roomId: s.roomId, productsOutcome: set ? 'accepted' : 'none', pinOutcome: 'none', round: { index: 0 } });
      }
      if (action === 'stop' && method === 'POST') {
        await sleep(600);
        s.status = 'idle';
        s.startedAt = null;
        s.roomId = null;
        db().auto[id].phase = 'idle';
        db().auto[id].phaseStartedAt = null;
        return json({ item: session(id), roomEnd: 'ended' });
      }
      if (action === 'video' && method === 'PUT') {
        const b = await body(req);
        s.videoId = typeof b.videoId === 'string' ? b.videoId : s.videoId;
        return json({ item: session(id) });
      }
      if (action === 'config' && method === 'PUT') {
        s.hasRtmpConfig = true;
        return json({ item: session(id) });
      }
      if (action === 'auto-settings') {
        if (method === 'PUT') {
          const b = await body(req);
          const next = (b.settings ?? b) as Record<string, unknown>;
          db().auto[id].settings = { ...db().auto[id].settings, ...next } as never;
        }
        return json({ item: autoState(id) });
      }
      if (action === 'product-pin') return json({ hasRequest: method === 'PUT' });
      if (action === 'pin-product' && method === 'POST') {
        const b = await body(req);
        if (s.status !== 'live') return fail('เริ่ม LIVE ของบัญชีนี้ก่อนปักหมุด', 409);
        const pid = String(b.productId ?? '');
        db().carts[id].pinnedId = pid || db().carts[id].pinnedId;
        return json({ outcome: 'accepted' });
      }
      if (action === 'sales' && !a4) return json(sales(id));
      if (action === 'sales' && a4 === 'refresh') {
        await sleep(500);
        return json(sales(id));
      }
      if (action === 'sales' && a4 === 'month') {
        const month = q.get('month') ?? now().slice(0, 7);
        const days = salesFor(id).days.filter((d) => d.day.startsWith(month) && d.rooms);
        const acc = account(id);
        return json({
          month,
          rooms: days.flatMap((d, i) =>
            Array.from({ length: d.rooms }, (_, r) => ({
              roomId: `7300${d.day.replace(/-/g, '')}${String(i * 10 + r).padStart(7, '0')}`,
              title: acc?.liveTitle ?? 'LIVE',
              startedAt: `${d.day}T${String(10 + r * 3).padStart(2, '0')}:00:00.000Z`,
              finishedAt: `${d.day}T${String(12 + r * 3).padStart(2, '0')}:00:00.000Z`,
              gmv: Math.round((d.gmv / d.rooms) * 100) / 100,
              itemsSold: Math.round(d.itemsSold / d.rooms),
              views: 300 + ((i * 97 + r * 41) % 900),
              impressions: 3000 + ((i * 523 + r * 211) % 9000),
            })),
          ),
        });
      }
      if (action === 'basket') {
        const cart = db().carts[id] ?? (db().carts[id] = { ids: [], pinnedId: null });
        if (method === 'GET') {
          const view = q.get('view');
          await sleep(300);
          if (view === 'showcase') return json({ products: db().products.map((p) => basketProduct(p.id)), pinnedId: null });
          if (view === 'cart') return json({ products: cart.ids.map(basketProduct).filter(Boolean), pinnedId: cart.pinnedId });
          if (view === 'sets')
            return json({ sets: db().sets.map((x, i) => ({ id: `900000000000000000${i}`, title: x.name, count: x.productIds.length })) });
          if (view === 'set') {
            const i = Number(String(q.get('setId')).slice(-1));
            const x = db().sets[i];
            return json({ products: (x?.productIds ?? []).map(basketProduct).filter(Boolean), pinnedId: null });
          }
          return fail('ไม่พบมุมมองนี้', 404);
        }
        const b = await body(req);
        const ids = (Array.isArray(b.productIds) ? b.productIds : []).map(String);
        await sleep(400);
        if (b.action === 'preview') {
          const links = Array.isArray(b.links) ? b.links.length : 0;
          return json({ products: db().products.slice(0, Math.min(links, db().products.length)).map((p) => basketProduct(p.id)) });
        }
        if (b.action === 'add') cart.ids = [...cart.ids, ...ids.filter((x) => !cart.ids.includes(x))];
        if (b.action === 'remove') {
          cart.ids = cart.ids.filter((x) => !ids.includes(x));
          if (cart.pinnedId && ids.includes(cart.pinnedId)) cart.pinnedId = null;
        }
        if (b.action === 'pin') cart.pinnedId = ids[0] ?? null;
        if (b.action === 'move') {
          const from = cart.ids.indexOf(ids[0]);
          const to = Number(b.index);
          if (from >= 0 && to >= 0 && to < cart.ids.length) {
            cart.ids.splice(from, 1);
            cart.ids.splice(to, 0, ids[0]);
          }
        }
        return json({ outcomes: Object.fromEntries(ids.map((x) => [x, 'accepted'])) });
      }
    }

    if (a1 === 'videos') {
      const d = db();
      if (!a2 && method === 'GET') {
        const accountId = q.get('accountId');
        const list = accountId
          ? d.videos.filter((v) => v.accountId === accountId)
          : q.get('unassigned')
            ? d.videos.filter((v) => !v.accountId)
            : all || q.get('scope') === 'all'
              ? d.videos
              : d.videos.filter((v) => v.owner === ws);
        return json({ items: list.map((v) => publicVideo(v, all)) });
      }
      const v = d.videos.find((x) => x.id === a2);
      if (!v) return fail('ไม่พบวิดีโอ', 404);
      if (a3 === 'file') return fail(DEMO_NOTE + ' (ไม่มีไฟล์วิดีโอจริง)', 404);
      if (a3 === 'prepare' && method === 'POST') return json({ item: publicVideo({ ...v, status: 'ready' }) });
      if (a3 === 'channel' && method === 'PUT') {
        const b = await body(req);
        v.accountId = typeof b.accountId === 'string' ? b.accountId : v.accountId;
        return json({ item: publicVideo(v) });
      }
      if (!a3 && method === 'DELETE') {
        if (Object.values(d.sessions).some((s) => s.videoId === v.id && s.status === 'live'))
          return fail('วิดีโอนี้กำลังใช้อยู่ในไลฟ์', 409);
        d.videos = d.videos.filter((x) => x.id !== v.id);
        return json({ ok: true });
      }
    }

    // Uploads: chunks are accepted and thrown away; only the name and size are kept.
    if (a1 === 'uploads') {
      const d = db();
      if (!a2 && method === 'POST') {
        const b = await body(req);
        const size = Number(b.size) || 0;
        const chunkSize = 8 * 1024 * 1024;
        const info = { uploadId: uuid(), name: String(b.name ?? 'video.mp4'), size, chunkSize, total: Math.max(1, Math.ceil(size / chunkSize)), received: [] as number[], accountId: q.get('accountId'), state: 'uploading' as const };
        d.uploads[info.uploadId] = info;
        return json(info, 201);
      }
      const up = a2 ? d.uploads[a2] : undefined;
      if (!up) return fail('ไม่พบการอัปโหลดนี้', 404);
      if (a3 === 'chunks' && method === 'PUT') {
        await req.arrayBuffer().catch(() => null);
        const index = Number(a4);
        if (!up.received.includes(index)) up.received.push(index);
        return json({ ok: true });
      }
      if (a3 === 'complete' && method === 'POST') {
        const item: DemoVideo = { id: uuid(), name: up.name, accountId: up.accountId, owner: ws, sizeBytes: up.size, createdAt: now(), status: 'ready' };
        d.videos.unshift(item);
        Object.assign(up, { state: 'done', item });
        return json({ ...up, item: publicVideo(item) }, 202);
      }
      if (!a3 && method === 'GET') return json({ ...up, ...(up.item ? { item: publicVideo(up.item) } : {}) });
      if (!a3 && method === 'DELETE') {
        delete d.uploads[up.uploadId];
        return json({ ok: true });
      }
    }

    if (a1 === 'products' && method === 'POST') {
      const b = await body(req);
      await sleep(400);
      if (b.action === 'preview') return json({ roomId: '', productIds: db().products.slice(0, 4).map((p) => p.id), count: 4 });
      return json({ outcome: 'accepted' });
    }

    if (a1 === 'product-sets') {
      const d = db();
      if (!a2 && method === 'GET') {
        const accountId = q.get('accountId');
        return json({ items: d.sets.filter((s) => !accountId || s.accountId === accountId || !s.accountId).map((s) => productSet(s.id)) });
      }
      if (!a2 && method === 'POST') {
        const b = await body(req);
        const set = {
          id: uuid(), name: String(b.name ?? 'ชุดสินค้าใหม่'), accountId: typeof b.accountId === 'string' && b.accountId ? b.accountId : null,
          productIds: d.products.slice(0, 4).map((p) => p.id), autoApply: false, hasDelete: typeof b.deleteCurl === 'string' && !!b.deleteCurl, createdAt: now(), updatedAt: now(),
        };
        d.sets.push(set);
        return json({ item: productSet(set.id) }, 201);
      }
      const set = d.sets.find((s) => s.id === a2);
      if (!set) return fail('ชุดสินค้าถูกลบหรือผูกกับบัญชีอื่น', 404);
      if (!a3 && method === 'GET') return json({ item: productSet(set.id) });
      if (!a3 && method === 'PATCH') {
        const b = await body(req);
        if (typeof b.name === 'string') set.name = b.name;
        if (typeof b.accountId === 'string') set.accountId = b.accountId || null;
        set.updatedAt = now();
        return json({ item: productSet(set.id) });
      }
      if (!a3 && method === 'DELETE') {
        d.sets = d.sets.filter((s) => s.id !== set.id);
        return json({ ok: true });
      }
      if (a3 === 'product-names') return json({ productNames: productNames(set.productIds) });
      if (a3 === 'auto' && method === 'POST') {
        const b = await body(req);
        set.autoApply = b.enabled === true;
        return json({ item: productSet(set.id) });
      }
      if ((a3 === 'send' || a3 === 'remove') && method === 'POST') {
        await sleep(500);
        if (set.accountId && a3 === 'send') {
          const cart = d.carts[set.accountId];
          if (cart) cart.ids = [...new Set([...cart.ids, ...set.productIds])];
        }
        if (set.accountId && a3 === 'remove') {
          const cart = d.carts[set.accountId];
          if (cart) cart.ids = cart.ids.filter((x) => !set.productIds.includes(x));
        }
        return json({ outcome: 'accepted', queuedForLive: set.autoApply });
      }
    }
  }

  // ---- AI comment replies -----------------------------------------------------------------
  if (root === 'ai-comments' && a1) {
    const ai = db().ai[a1];
    if (!ai) return fail('ไม่พบบัญชีนี้', 404);
    const state = () => ({
      settings: ai.settings,
      history: ai.history,
      hasApiKey: ai.hasApiKey,
      aiReady: ai.hasApiKey,
      chatReady: ai.chatConnected,
      connection: { mode: 'session', connected: ai.chatConnected, hasCapture: ai.chatConnected, message: ai.chatConnected ? 'เชื่อมแชทแล้ว (ตัวอย่าง)' : 'ยังไม่ได้เชื่อมแชท' },
    });
    if (!a2 && method === 'GET') return json(state());
    if (a2 === 'chat-session') {
      if (method === 'GET') return json({ capture: '' });
      const b = await body(req);
      ai.chatConnected = b.remove !== true;
      return json(state());
    }
    if (a2 === 'models') return json({ models: ['demo-model', 'demo-model-mini'] });
    if (a2 === 'settings' && method === 'PATCH') {
      const b = await body(req);
      const { apiKey, ...rest } = b;
      ai.settings = { ...ai.settings, ...(rest as object) };
      if (typeof apiKey === 'string' && apiKey) ai.hasApiKey = true;
      return json(state());
    }
    if (a2 === 'preview' && method === 'POST') {
      const b = await body(req);
      const comment = String(b.comment ?? b.text ?? '').trim() || 'ราคาเท่าไหร่คะ';
      const keyword = ai.settings.keywordReplies.split('\n').map((l) => l.split('=')).find(([k]) => k && comment.includes(k.trim()));
      const reply = keyword ? keyword[1].trim() : `(คำตอบตัวอย่าง) ขอบคุณที่ถามค่ะ เรื่อง “${comment.slice(0, 40)}” กดตะกร้าดูรายละเอียดได้เลยนะคะ`;
      const item = { id: uuid(), comment, reply, reason: null, status: 'sent' as const, preview: true, createdAt: now() };
      ai.history.unshift(item);
      return json({ item });
    }
  }

  // ---- users (admin) ----------------------------------------------------------------------
  if (root === 'users') {
    const d = db();
    if (a1 === 'workspace') {
      if (method === 'POST') {
        const b = await body(req);
        const owner = String(b.owner ?? user);
        if (!d.users.some((u) => u.username === owner)) return fail('ไม่พบผู้ใช้', 404);
        if (owner === user) delete d.workspace[user];
        else d.workspace[user] = owner;
        return json({ owner, actor: user });
      }
      return json({ owner: ws, actor: user });
    }
    if (user !== DEMO_ADMIN && a1 !== 'password') return fail('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
    if (!a1 && method === 'GET') return json({ items: d.users });
    if (!a1 && method === 'POST') {
      const b = await body(req);
      const username = String(b.username ?? '').trim();
      if (!/^[A-Za-z0-9_.@-]{3,64}$/.test(username)) return fail('ชื่อผู้ใช้ไม่ถูกต้อง');
      if (d.users.some((u) => u.username === username)) return fail('มีชื่อผู้ใช้นี้แล้ว', 409);
      const item = { username, role: 'member' as const, enabled: true, sessionVersion: 1, createdAt: now(), legacy: false };
      d.users.push(item);
      return json({ item }, 201);
    }
    if (a1 === 'accounts' && !a2) return json({ items: d.accounts.map((a) => ({ id: a.id, owner: a.owner, alias: a.alias, handle: a.verifiedHandle ?? a.claimedHandle })) });
    if (a1 === 'accounts' && a3 === 'assign' && method === 'POST') {
      const b = await body(req);
      const acc = account(String(a2));
      if (!acc) return fail('ไม่พบบัญชีนี้', 404);
      if (d.sessions[acc.id]?.status === 'live') return fail('หยุดไลฟ์ก่อนย้ายบัญชี', 409);
      acc.owner = String(b.owner ?? acc.owner);
      return json({ item: { id: acc.id, owner: acc.owner, alias: acc.alias, handle: acc.claimedHandle } });
    }
    if (a1 === 'password' && method === 'POST') return json({ ok: true });
    const target = d.users.find((u) => u.username === decodeURIComponent(String(a1)));
    if (!target) return fail('ไม่พบผู้ใช้', 404);
    if (method === 'PATCH') {
      const b = await body(req);
      if (typeof b.enabled === 'boolean') target.enabled = b.enabled;
      if (typeof b.password === 'string') target.sessionVersion += 1;
      return json({ item: target });
    }
    if (method === 'DELETE') {
      if (target.username === DEMO_ADMIN) return fail('ลบผู้ดูแลหลักไม่ได้', 409);
      if (d.accounts.some((a) => a.owner === target.username)) return fail('ย้ายบัญชี TikTok ของผู้ใช้นี้ออกก่อน', 409);
      d.users = d.users.filter((u) => u !== target);
      return json({ ok: true });
    }
  }

  // ---- LINE alerts, stats sources, Shop helper, Boxphone: UI only ------------------------
  if (root === 'line-alerts') {
    const s = db().lineAlerts;
    if (a1 === 'test') return fail(DEMO_NOTE, 409);
    if (method === 'PUT') {
      const b = await body(req);
      if (typeof b.token === 'string' && b.token) s.hasToken = true;
      if (typeof b.secret === 'string' && b.secret) s.hasSecret = true;
      if (typeof b.enabled === 'boolean') s.enabled = b.enabled;
    }
    return json(s);
  }
  if (root === 'line') return json({ ok: true });

  if (root === 'stats-sources') {
    const d = db();
    if (!a1 && method === 'GET') return json({ items: d.statsSources });
    if (!a1 && method === 'POST') {
      const b = await body(req);
      const item = { id: uuid(), name: String(b.name ?? 'แหล่งข้อมูลตัวอย่าง'), host: 'example.com', path: '/stats', method: 'GET' as const, accountId: typeof b.accountId === 'string' ? b.accountId : null, hasCookie: true, lastRunAt: null, lastStatus: null };
      d.statsSources.push(item);
      return json({ item }, 201);
    }
    const src = d.statsSources.find((s) => s.id === a1);
    if (!src) return fail('ไม่พบแหล่งข้อมูล', 404);
    if (a2 === 'run') {
      src.lastRunAt = now();
      src.lastStatus = '200';
      return json({ ok: true, status: 200, fetchedAt: now(), data: { gmv: 1234.5, orders: 12, note: DEMO_NOTE } });
    }
    if (method === 'PATCH') return json({ item: src });
    if (method === 'DELETE') {
      d.statsSources = d.statsSources.filter((s) => s !== src);
      return json({ ok: true });
    }
  }

  if (root === 'shop-relay') {
    if (a1 === 'agents' && !a2 && method === 'GET') return json({ items: [], relayUrl: null });
    if (a1 === 'agents' && method === 'DELETE') return json({ ok: true });
    return fail(DEMO_NOTE, 409);
  }

  if (root === 'boxphone' || root === 'boxphone-agent') {
    if (a1 === 'health') return json({ app: 'boxphone-lab', version: 'demo' });
    if (a1 === 'computers') return json({ mode: 'local', computers: [] });
    if (a1 === 'view')
      return new Response(
        `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#15142a;color:#ecebff;font-family:sans-serif;text-align:center"><div><h2 style="color:#45e0f0">Boxphone</h2><p>${DEMO_NOTE}</p><p style="color:#a9a6d4">ในระบบจริง หน้านี้ใช้ควบคุมมือถือที่ต่อกับคอม และให้ AI ตอบคำถามผ่านมือถือ</p></div></body>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    return fail(DEMO_NOTE, 409);
  }

  if (root === 'chat-bridge') return fail(DEMO_NOTE, 409);

  return fail('ไม่พบคำสั่ง', 404);
}
