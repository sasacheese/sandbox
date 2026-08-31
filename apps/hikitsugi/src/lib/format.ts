/** 表示の整形。 */

export function clockTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** 一覧に出す時刻。今日なら時刻、それより前は日付。 */
export function listTime(iso: string | null, now: Date): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) return clockTime(iso);
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  if (days < 7) return `${days} 日前`;
  return at.toLocaleDateString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric' });
}

export function dateLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** 親密度の言い換え。数値だけだと、何を渡されたのか掴めない。 */
export function closenessLabel(value: number): string {
  if (value >= 80) return '何でも話す';
  if (value >= 60) return '打ち明ける';
  if (value >= 40) return '親しい';
  if (value >= 25) return '顔を覚えている';
  return '離れかけている';
}

export function initial(name: string): string {
  return [...name.trim()][0] ?? '?';
}

/** 名前から色相を決める。同じ名前なら必ず同じ色。 */
export function hueOf(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return hash;
}
