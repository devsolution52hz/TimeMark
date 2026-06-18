// Định dạng ngày giờ kiểu TimeMark (tiếng Việt)

const WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** "00:16" */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "13 Tháng 6,2026" */
export function formatDate(d: Date): string {
  return `${d.getDate()} Tháng ${d.getMonth() + 1},${d.getFullYear()}`;
}

/** "Thứ Bảy" */
export function formatWeekday(d: Date): string {
  return WEEKDAYS_VI[d.getDay()];
}

/** Mã xác minh giả lập kiểu "11GAB323LEWL6C" */
export function makeVerifyCode(seed?: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = '';
  const base = seed ?? Date.now();
  let x = base;
  for (let i = 0; i < 13; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    s += chars[x % chars.length];
  }
  return s;
}
