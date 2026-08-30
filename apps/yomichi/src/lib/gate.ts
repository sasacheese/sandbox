/**
 * 入口の錠。
 *
 * 配信元が GitHub Pages（公開）なので、**平文の合言葉をバンドルへ埋め込むことは
 * できない**。埋め込んだ時点で誰でも読める。置けるのは合言葉から一方向に作った
 * 値だけで、照合はブラウザ側で毎回作り直して比べる。
 *
 * これは「URL を踏んだ人がそのまま中へ入らない」ための錠であって、本気で
 * 中身を隠す仕組みではない（リポジトリが公開である以上、鍵の掛かった扉の
 * 隣に設計図が貼ってある状態にあたる）。強さは合言葉の推測しにくさで決まる。
 */

import { GATE } from '../gate.config.ts';

const UNLOCKED_KEY = 'yomichi:unlocked';

/** WebCrypto は SharedArrayBuffer を受け取らないので、素の ArrayBuffer で作る。 */
function toBytes(base64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** 合言葉から digest を作る。全角・半角の揺れは NFKC で寄せる。 */
export async function digestOf(passphrase: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFKC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toBytes(GATE.salt), iterations: GATE.iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64(bits);
}

export async function verify(passphrase: string): Promise<boolean> {
  return (await digestOf(passphrase)) === GATE.digest;
}

/**
 * 解錠済みか。
 *
 * 保存するのは digest なので、合言葉を変えれば（digest が変われば）
 * 解錠済みの端末も自動的に入口へ戻る。
 */
export function unlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === GATE.digest;
  } catch {
    return false;
  }
}

export function remember(): void {
  try {
    localStorage.setItem(UNLOCKED_KEY, GATE.digest);
  } catch {
    // プライベートブラウズなど。この起動のあいだは開いたままなので、そのまま進む
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // 消せなくても実害は無い
  }
}
