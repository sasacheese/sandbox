/** 表示の整形。時刻は「いつ集まるか」しか意味を持たないので、そこに寄せてある。 */

/** 集合時刻。日付が今日なら時刻だけ。 */
export function clockTime(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  const time = at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) return time;
  return `${at.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} ${time}`;
}

export function dateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return `${at.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })} ${at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** 集合までの残り。過ぎていたら経過を返す。 */
export function countdown(iso: string, now: Date): { text: string; passed: boolean } {
  const ms = new Date(iso).getTime() - now.getTime();
  const passed = ms <= 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { text, passed };
}

function pad(n: number): string {
  return `${n}`.padStart(2, '0');
}

export function since(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes} 分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 時間前`;
  return `${Math.floor(hours / 24)} 日前`;
}

export function initial(name: string): string {
  return [...name.trim()][0] ?? '?';
}
