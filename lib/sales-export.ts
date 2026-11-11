/**
 * Monthly LIVE sales workbook per channel, laid out like the team's monthly commission file:
 * "สรุป GMV <เดือน>" (per channel, formulas over the room list), "รายการ LIVE" (one row per room)
 * and "แหล่งข้อมูล" (where each channel's numbers came from). Built in the browser.
 */
export type ExportRoom = {
  roomId: string;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  gmv: number;
  itemsSold: number;
  views: number;
  impressions: number;
};
export type ExportChannel = {
  alias: string;
  username: string;
  rooms: ExportRoom[] | null;
  error?: string;
};

const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const FONT = 'Arial';
const HEADER_FILL = 'FF16A085';
const MONEY = '#,##0.00';
const COUNT = '#,##0';
const DATE = 'dd/mm/yyyy hh:mm';

/** Excel shows the wall-clock time stored, so move Bangkok time into the UTC fields. */
const bangkok = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 7 * 3_600_000) : null);

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return { full: `${MONTHS[m - 1]} ${y}`, short: `${SHORT[m - 1]} ${y}`, days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

export async function buildSalesWorkbook(month: string, rate: number, channels: ExportChannel[]) {
  const { default: ExcelJS } = await import('exceljs');
  const label = monthLabel(month);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Livehub';
  const summaryName = `สรุป GMV ${label.short}`;
  const summary = wb.addWorksheet(summaryName, { views: [{ state: 'frozen', ySplit: 4 }] });
  const list = wb.addWorksheet('รายการ LIVE', { views: [{ state: 'frozen', ySplit: 3 }] });
  const source = wb.addWorksheet('แหล่งข้อมูล', { views: [{ state: 'frozen', ySplit: 3 }] });

  const style = (ws: import('exceljs').Worksheet) =>
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell((cell) => {
        cell.font = { ...cell.font, name: FONT, size: cell.font?.size ?? 10 };
        cell.alignment = { vertical: 'top', wrapText: true, ...cell.alignment };
      }),
    );
  const header = (row: import('exceljs').Row) =>
    row.eachCell((cell) => {
      cell.font = { name: FONT, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
  const title = (ws: import('exceljs').Worksheet, text: string, lastCol: string) => {
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell('A1').value = text;
    ws.getCell('A1').font = { name: FONT, bold: true, size: 14 };
  };
  const notes = (ws: import('exceljs').Worksheet, from: number, lastCol: string, lines: string[]) =>
    lines.forEach((line, i) => {
      ws.mergeCells(`A${from + i}:${lastCol}${from + i}`);
      ws.getCell(`A${from + i}`).value = line;
      ws.getCell(`A${from + i}`).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF555555' } };
    });

  // ---- รายการ LIVE: one row per room, counted by the time the LIVE started (Bangkok) ----
  title(list, `รายการ LIVE จาก TikTok Shop — 1–${label.days} ${label.full}`, 'I');
  list.mergeCells('A2:I2');
  list.getCell('A2').value =
    '1 แถวต่อ Room ID; นับตามเวลาเริ่ม LIVE ในเดือน (เวลาไทย); ตัวเลขจากหน้า LIVE performance ของแต่ละช่อง';
  header(
    list.addRow([
      'Username', 'Room ID', 'ชื่อไลฟ์', 'เริ่ม LIVE', 'จบ LIVE',
      'Attributed GMV (บาท)', 'สินค้าที่ขายได้ (ชิ้น)', 'Views', 'Impressions',
    ]),
  );
  const rooms = channels.flatMap((c) => (c.rooms ?? []).map((r) => ({ c, r })));
  for (const { c, r } of rooms) {
    const row = list.addRow([
      c.username, r.roomId, r.title, bangkok(r.startedAt), bangkok(r.finishedAt),
      r.gmv, r.itemsSold, r.views, r.impressions,
    ]);
    row.getCell(2).numFmt = '@';
    row.getCell(4).numFmt = DATE;
    row.getCell(5).numFmt = DATE;
    row.getCell(6).numFmt = MONEY;
    for (const i of [7, 8, 9]) row.getCell(i).numFmt = COUNT;
  }
  const lastRoom = Math.max(4, 3 + rooms.length);
  list.columns.forEach((col, i) => (col.width = [22, 22, 34, 18, 18, 19, 15, 12, 14][i]));

  // ---- สรุป GMV: per channel, formulas over the room list so edits to rooms flow through ----
  title(summary, `สรุป GMV รายช่องและค่าคอมมิชชั่น — 1–${label.days} ${label.full}`, 'J');
  summary.mergeCells('A2:B2');
  summary.getCell('A2').value = 'อัตราค่าคอมมิชชั่นของ GMV';
  summary.getCell('A2').font = { name: FONT, bold: true };
  summary.getCell('C2').value = rate;
  summary.getCell('C2').numFmt = '0.0%';
  summary.getCell('C2').font = { name: FONT, bold: true, color: { argb: 'FF0000FF' } };
  summary.getCell('C2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  summary.mergeCells('D2:J2');
  summary.getCell('D2').value = 'แก้ตัวเลขช่อง C2 ได้ ค่าคอมมิชชั่นทุกช่องคำนวณใหม่อัตโนมัติ';
  summary.addRow([]);
  header(
    summary.addRow([
      'ลำดับ', 'ชื่อช่อง', 'ชื่อผู้ใช้ (Username)', 'GMV ที่ได้ (บาท)', 'สินค้าที่ขายได้ (ชิ้น)',
      'ยอดการรับชม', 'ยอดการแสดงผล LIVE', 'จำนวน LIVE', null, 'หมายเหตุ',
    ]),
  );
  summary.getCell('I4').value = { formula: '"ค่าคอมมิชชั่น "&TEXT($C$2,"0.0%")&" (บาท)"', result: '' };
  const range = (col: string) => `'รายการ LIVE'!$${col}$4:$${col}$${lastRoom}`;
  channels.forEach((c, i) => {
    const r = 5 + i;
    const row = summary.addRow([
      i + 1,
      c.alias,
      c.username,
      { formula: `SUMIF(${range('A')},C${r},${range('F')})` },
      { formula: `SUMIF(${range('A')},C${r},${range('G')})` },
      { formula: `SUMIF(${range('A')},C${r},${range('H')})` },
      { formula: `SUMIF(${range('A')},C${r},${range('I')})` },
      { formula: `COUNTIF(${range('A')},C${r})` },
      { formula: `D${r}*$C$2` },
      c.rooms === null
        ? `ดึงข้อมูลไม่สำเร็จ: ${c.error ?? 'ไม่ทราบสาเหตุ'} — ยอดเป็น 0 จนกว่าจะส่งออกใหม่`
        : c.rooms.length
          ? null
          : 'ไม่พบ LIVE ในเดือนนี้',
    ]);
    row.getCell(4).numFmt = MONEY;
    row.getCell(9).numFmt = MONEY;
    for (const k of [5, 6, 7, 8]) row.getCell(k).numFmt = COUNT;
  });
  const first = 5;
  const last = 4 + channels.length;
  const total = summary.addRow([
    null, null, 'รวมทั้งหมด',
    ...['D', 'E', 'F', 'G', 'H', 'I'].map((col) => ({ formula: `SUM(${col}${first}:${col}${Math.max(first, last)})` })),
  ]);
  total.font = { name: FONT, bold: true };
  total.getCell(4).numFmt = MONEY;
  total.getCell(9).numFmt = MONEY;
  for (const k of [5, 6, 7, 8]) total.getCell(k).numFmt = COUNT;
  summary.columns.forEach((col, i) => (col.width = [7, 26, 24, 19, 15, 16, 18, 12, 21, 43][i]));
  const failed = channels.filter((c) => c.rooms === null).map((c) => c.username);
  notes(summary, last + 3, 'J', [
    'GMV และตัวชี้วัดรวมจากชีต "รายการ LIVE" (นับตามเวลาเริ่ม LIVE) ที่ Livehub ดึงจาก TikTok Shop ของแต่ละช่องโดยตรง',
    'ค่าคอมมิชชั่น = GMV × อัตราในช่อง C2 โดยไม่ปัดเศษรายช่องก่อนรวม',
    'ไม่มีคอลัมน์ Attributed orders เพราะหน้า LIVE performance ที่ Livehub อ่านไม่ส่งตัวเลขนี้มา',
    ...(failed.length ? [`ดึงข้อมูลไม่สำเร็จ: ${failed.join(', ')} — ตรวจ session แล้วส่งออกใหม่`] : []),
    `ส่งออกจาก Livehub วันที่ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
  ]);

  // ---- แหล่งข้อมูล: what was read for each channel ----
  title(source, `แหล่งข้อมูลเดือน${label.full}`, 'G');
  source.mergeCells('A2:G2');
  source.getCell('A2').value = 'Livehub อ่านหน้า LIVE performance ของ TikTok Shop ทีละช่องด้วย session ของบัญชีเอง ตอนกดส่งออก';
  header(source.addRow(['ลำดับ', 'ชื่อช่อง', 'Username', 'จำนวน LIVE', 'GMV (บาท)', 'สถานะการดึงข้อมูล', 'หมายเหตุ']));
  channels.forEach((c, i) => {
    const row = source.addRow([
      i + 1,
      c.alias,
      c.username,
      c.rooms?.length ?? null,
      c.rooms ? c.rooms.reduce((s, r) => s + r.gmv, 0) : null,
      c.rooms ? 'สำเร็จ' : 'ไม่สำเร็จ',
      c.rooms ? (c.rooms.length ? null : 'ไม่มี LIVE ในเดือนนี้') : (c.error ?? null),
    ]);
    row.getCell(5).numFmt = MONEY;
  });
  source.columns.forEach((col, i) => (col.width = [7, 26, 24, 12, 16, 18, 50][i]));

  for (const ws of [summary, list, source]) style(ws);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
