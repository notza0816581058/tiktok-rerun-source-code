// In-memory sample data for the demo. Every name, handle, product and number here is invented.
// State lives on globalThis so it survives Next.js hot reloads; restarting the dev server resets it.

export type LiveStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'failed';

export type DemoAccount = {
  id: string;
  owner: string;
  alias: string;
  liveTitle: string;
  claimedHandle: string;
  verifiedHandle: string | null;
  verifiedAt: string | null;
  verificationStatus: 'connected' | 'disconnected';
  probe: 'not_run';
  probeHttpStatus: null;
  createdAt: string;
  color: string;
};

export type DemoSession = {
  accountId: string;
  status: LiveStatus;
  videoId: string | null;
  hasRtmpConfig: boolean;
  roomId: string | null;
  startedAt: string | null;
};

export type DemoVideo = {
  id: string;
  name: string;
  accountId: string | null;
  owner: string;
  sizeBytes: number;
  createdAt: string;
  status: 'ready' | 'converting' | 'failed';
};

export type DemoProduct = {
  id: string;
  title: string;
  price: string;
  originalPrice: string | null;
  commission: string;
  shop: string;
  stock: number;
  labels: string[];
};

export type DemoProductSet = {
  id: string;
  name: string;
  accountId: string | null;
  productIds: string[];
  autoApply: boolean;
  hasDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AutoSettings = {
  endAfterMinutes: number | null;
  restartAfterMinutes: number | null;
  dailyStartTime: string | null;
  recoverStream: boolean;
  closedRoomAction: 'stop' | 'new_room';
  gmvTarget: number | null;
  gmvWithinMinutes: number | null;
  videoRotation: string[];
  productSetRotation: string[];
  autoAddProducts: boolean;
  autoPinProduct: boolean;
  productPinSelections: Record<string, string>;
};

export type AiSettings = {
  enabled: boolean;
  knowledge: string;
  instructions: string;
  cooldownSeconds: number;
  maxPerMinute: number;
  productName: string;
  answerWhen: 'all' | 'product';
  model: string;
  minWords: number;
  maxWords: number;
  strict: boolean;
  bannedWords: string;
  keywordReplies: string;
};

export type AiHistory = {
  id: string;
  comment: string;
  reply: string | null;
  reason: string | null;
  status: 'sent' | 'skipped' | 'failed';
  preview: boolean;
  createdAt: string;
};

export type DemoUser = {
  username: string;
  role: 'admin' | 'member';
  enabled: boolean;
  sessionVersion: number;
  createdAt: string;
  legacy: boolean;
};

export type StatsSource = {
  id: string;
  name: string;
  host: string;
  path: string;
  method: 'GET' | 'POST';
  accountId: string | null;
  hasCookie: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
};

type State = {
  accounts: DemoAccount[];
  sessions: Record<string, DemoSession>;
  videos: DemoVideo[];
  products: DemoProduct[];
  sets: DemoProductSet[];
  carts: Record<string, { ids: string[]; pinnedId: string | null }>;
  auto: Record<string, { settings: AutoSettings; phase: 'idle' | 'live' | 'resting'; phaseStartedAt: string | null; completedRounds: number }>;
  ai: Record<string, { settings: AiSettings; history: AiHistory[]; hasApiKey: boolean; chatConnected: boolean }>;
  users: DemoUser[];
  workspace: Record<string, string>;
  lineAlerts: { hasToken: boolean; hasSecret: boolean; enabled: boolean; group: string | null };
  statsSources: StatsSource[];
  uploads: Record<string, { uploadId: string; name: string; size: number; chunkSize: number; total: number; received: number[]; accountId: string | null; state: 'uploading' | 'done'; item?: DemoVideo }>;
};

export const DEMO_ADMIN = 'demo';
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

export const uuid = () => crypto.randomUUID();
export const productId = () =>
  '17' + Array.from({ length: 17 }, () => Math.floor(Math.random() * 10)).join('');

function seed(): State {
  const accounts: DemoAccount[] = [
    { id: 'a1000000-0000-4000-8000-000000000001', alias: 'ร้านตัวอย่าง A', liveTitle: 'ไลฟ์ขายเสื้อผ้าตัวอย่าง ลดทั้งร้าน', claimedHandle: 'demo.shop.a', color: '#ff2d8a' },
    { id: 'a1000000-0000-4000-8000-000000000002', alias: 'ร้านตัวอย่าง B', liveTitle: 'ของใช้ในบ้าน ราคาส่ง (ตัวอย่าง)', claimedHandle: 'demo.home.b', color: '#45e0f0' },
    { id: 'a1000000-0000-4000-8000-000000000003', alias: 'ร้านตัวอย่าง C', liveTitle: 'สกินแคร์ตัวอย่าง รีวิวสด', claimedHandle: 'demo.beauty.c', color: '#c6f56a' },
    { id: 'a1000000-0000-4000-8000-000000000004', alias: 'บัญชีทดสอบ D', liveTitle: 'บัญชีทดสอบ', claimedHandle: 'demo.test.d', color: '#ffc857' },
  ].map((a, i) => ({
    ...a,
    owner: i === 2 ? 'staff01' : DEMO_ADMIN,
    verifiedHandle: i === 3 ? null : a.claimedHandle,
    verifiedAt: i === 3 ? null : minutesAgo(30 + i * 7),
    verificationStatus: i === 3 ? 'disconnected' : 'connected',
    probe: 'not_run',
    probeHttpStatus: null,
    createdAt: daysAgo(40 - i * 5),
  }));

  const [A, B, C, D] = accounts.map((a) => a.id);
  const video = (name: string, accountId: string | null, mb: number, days: number, status: DemoVideo['status'] = 'ready'): DemoVideo => ({
    id: uuid(), name, accountId, owner: accountId === C ? 'staff01' : DEMO_ADMIN, sizeBytes: mb * 1024 * 1024, createdAt: daysAgo(days), status,
  });
  const videos = [
    video('demo-fashion-loop.mp4', A, 412, 12),
    video('demo-fashion-promo.mp4', A, 188, 6),
    video('demo-home-review.mp4', B, 356, 9),
    video('demo-skincare-live.mp4', C, 501, 4),
    video('demo-new-upload.mov', B, 97, 0, 'converting'),
    video('demo-unassigned-clip.mp4', null, 64, 20),
  ];

  const p = (title: string, price: number, rate: number, stock: number, labels: string[] = []): DemoProduct => ({
    id: productId(), title, price: `฿${price.toFixed(2)}`,
    originalPrice: labels.includes('ลดราคา') ? `฿${(price * 1.3).toFixed(2)}` : null,
    commission: `฿${((price * rate) / 100).toFixed(2)} · ${rate}%`, shop: 'Demo Shop', stock, labels,
  });
  const products = [
    p('เสื้อยืดคอกลม Cotton 100% (ตัวอย่าง)', 199, 10, 340, ['ขายดี']),
    p('กางเกงขาสั้นผ้าร่ม (ตัวอย่าง)', 259, 12, 120, ['ลดราคา']),
    p('หมวกแก๊ปปักโลโก้ (ตัวอย่าง)', 149, 8, 75),
    p('กล่องเก็บของพับได้ 3 ชิ้น (ตัวอย่าง)', 329, 15, 60, ['ส่งฟรี']),
    p('ผ้าไมโครไฟเบอร์ แพ็ก 10 (ตัวอย่าง)', 99, 10, 900),
    p('เซรั่มวิตามินซี 30ml (ตัวอย่าง)', 390, 20, 210, ['ขายดี', 'ลดราคา']),
    p('ครีมกันแดด SPF50 (ตัวอย่าง)', 290, 18, 150),
    p('โฟมล้างหน้าสูตรอ่อนโยน (ตัวอย่าง)', 159, 15, 400),
  ];
  const ids = products.map((x) => x.id);
  const set = (name: string, accountId: string | null, productIds: string[]): DemoProductSet => ({
    id: uuid(), name, accountId, productIds, autoApply: accountId !== null, hasDelete: true, createdAt: daysAgo(10), updatedAt: daysAgo(2),
  });
  const sets = [
    set('ชุดเสื้อผ้า (ตัวอย่าง)', A, ids.slice(0, 3)),
    set('ชุดของใช้ในบ้าน (ตัวอย่าง)', B, ids.slice(3, 5)),
    set('ชุดสกินแคร์ (ตัวอย่าง)', C, ids.slice(5, 8)),
  ];

  const baseAuto = (): AutoSettings => ({
    endAfterMinutes: 180, restartAfterMinutes: 15, dailyStartTime: null, recoverStream: true, closedRoomAction: 'new_room',
    gmvTarget: null, gmvWithinMinutes: null, videoRotation: [], productSetRotation: [], autoAddProducts: true, autoPinProduct: false, productPinSelections: {},
  });
  const auto: State['auto'] = {};
  for (const a of accounts) auto[a.id] = { settings: baseAuto(), phase: 'idle', phaseStartedAt: null, completedRounds: 0 };
  auto[A] = {
    settings: { ...baseAuto(), videoRotation: [videos[0].id, videos[1].id], productSetRotation: [sets[0].id], gmvTarget: 500, gmvWithinMinutes: 60, autoPinProduct: true, productPinSelections: { [sets[0].id]: ids[0] } },
    phase: 'live', phaseStartedAt: minutesAgo(42), completedRounds: 2,
  };
  auto[B] = { settings: { ...baseAuto(), dailyStartTime: '19:00', videoRotation: [videos[2].id], productSetRotation: [sets[1].id] }, phase: 'idle', phaseStartedAt: null, completedRounds: 0 };

  const aiSettings = (productName: string): AiSettings => ({
    enabled: false, knowledge: '', instructions: 'ตอบสุภาพ เป็นกันเอง ชวนกดตะกร้า (ตัวอย่าง)', cooldownSeconds: 10, maxPerMinute: 3,
    productName, answerWhen: 'all', model: 'demo-model', minWords: 0, maxWords: 30, strict: true, bannedWords: 'คำต้องห้ามตัวอย่าง',
    keywordReplies: 'ราคา=กดตะกร้าดูราคาล่าสุดได้เลยค่ะ\nส่งฟรี=ส่งฟรีเมื่อซื้อครบตามเงื่อนไขร้านค่ะ',
  });
  const ai: State['ai'] = {};
  for (const a of accounts) ai[a.id] = { settings: aiSettings(''), history: [], hasApiKey: false, chatConnected: false };
  ai[A] = {
    settings: { ...aiSettings('เสื้อยืดคอกลม Cotton 100%'), enabled: true, knowledge: 'ไซซ์ S–XL ผ้าคอตตอน 100% ส่งภายใน 2 วัน (ข้อมูลตัวอย่าง)' },
    hasApiKey: true, chatConnected: true,
    history: [
      { id: uuid(), comment: 'มีไซซ์ XL ไหมคะ', reply: 'มีไซซ์ XL ค่ะ กดตะกร้าเลือกไซซ์ได้เลยนะคะ', reason: null, status: 'sent', preview: false, createdAt: minutesAgo(3) },
      { id: uuid(), comment: 'ส่งกี่วัน', reply: 'จัดส่งภายใน 2 วันทำการค่ะ', reason: null, status: 'sent', preview: false, createdAt: minutesAgo(9) },
      { id: uuid(), comment: '55555', reply: null, reason: 'ไม่ใช่คำถาม ข้ามการตอบ', status: 'skipped', preview: false, createdAt: minutesAgo(12) },
    ],
  };

  const sessions: Record<string, DemoSession> = {};
  for (const a of accounts) sessions[a.id] = { accountId: a.id, status: 'idle', videoId: null, hasRtmpConfig: false, roomId: null, startedAt: null };
  sessions[A] = { accountId: A, status: 'live', videoId: videos[0].id, hasRtmpConfig: true, roomId: '7300000000000000001', startedAt: minutesAgo(42) };
  sessions[B] = { ...sessions[B], videoId: videos[2].id, hasRtmpConfig: true };
  sessions[C] = { ...sessions[C], videoId: videos[3].id, hasRtmpConfig: true };

  return {
    accounts, sessions, videos, products, sets,
    carts: { [A]: { ids: ids.slice(0, 3), pinnedId: ids[0] }, [B]: { ids: [], pinnedId: null }, [C]: { ids: [], pinnedId: null }, [D]: { ids: [], pinnedId: null } },
    auto, ai,
    users: [
      { username: DEMO_ADMIN, role: 'admin', enabled: true, sessionVersion: 1, createdAt: daysAgo(60), legacy: false },
      { username: 'staff01', role: 'member', enabled: true, sessionVersion: 1, createdAt: daysAgo(30), legacy: false },
    ],
    workspace: {},
    lineAlerts: { hasToken: false, hasSecret: false, enabled: false, group: null },
    statsSources: [],
    uploads: {},
  };
}

const g = globalThis as unknown as { __liveHubDemo?: State };
export function db(): State {
  g.__liveHubDemo ??= seed();
  return g.__liveHubDemo;
}

/** Deterministic pseudo-random sales so numbers stay stable between refreshes. */
export function salesFor(accountId: string) {
  let s = [...accountId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const scale = accountId.endsWith('1') ? 1 : accountId.endsWith('2') ? 0.55 : accountId.endsWith('3') ? 0.8 : 0;
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86_400_000);
    const rooms = scale ? Math.floor(rnd() * 4) : 0;
    const itemsSold = rooms ? Math.floor(rnd() * 25 * scale) : 0;
    const gmv = Math.round(itemsSold * (150 + rnd() * 200) * 100) / 100;
    return { day: d.toISOString().slice(0, 10), gmv, itemsSold, rooms };
  });
  const sum = (list: typeof days) => ({
    gmv: Math.round(list.reduce((n, d) => n + d.gmv, 0) * 100) / 100,
    itemsSold: list.reduce((n, d) => n + d.itemsSold, 0),
    rooms: list.reduce((n, d) => n + d.rooms, 0),
  });
  return { days, today: days[29], last7: sum(days.slice(-7)), last30: sum(days) };
}
