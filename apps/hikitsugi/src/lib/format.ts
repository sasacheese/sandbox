/** 表示の整形。書類の書式に寄せる。 */

export function dateLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function dateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return `${at.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** 期限まで何日か。過ぎていたら過ぎた日数を返す。 */
export function dueLabel(dueDay: number, elapsed: number): { text: string; overdue: boolean } {
  const left = dueDay - elapsed;
  if (left > 0) return { text: `あと ${left} 日`, overdue: false };
  if (left === 0) return { text: '今日', overdue: false };
  return { text: `${-left} 日 超過`, overdue: true };
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

export function hueOf(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return hash;
}
