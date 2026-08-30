/** 表示の整形。掲示板なので、時刻の粒度は「さっき」「昨日」で足りる。 */

export function since(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨日';
  if (days < 7) return `${days}日前`;
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

/** 集まりの日時。曜日まで出す（週末かどうかが行けるかを決めるので）。 */
export function gatheringWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const date = at.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
  const time = at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export function dateLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function initial(name: string): string {
  return [...name.trim()][0] ?? '?';
}

/**
 * 名前から色を決める。
 *
 * 画像を持たない住人を見分けるための最小限の手掛かり。同じ名前なら必ず同じ色に
 * なるよう、文字コードの和から色相を取る。彩度と明度は固定して、並んだときに
 * 一人だけ浮かないようにする。
 */
export function hueOf(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return hash;
}
