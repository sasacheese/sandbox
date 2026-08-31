/**
 * 合言葉の digest を作る。
 *
 *   node scripts/passphrase.mjs "あいことば"
 *
 * 出力を src/gate.config.ts へ書き込む。**平文はここにも成果物にも残さない。**
 * このリポジトリは公開なので、平文を置いた時点で合言葉ではなくなる。
 *
 * 置けるのは「合言葉から一方向に作った値」だけ。つまり守りの強さは、
 * 合言葉そのものの推測しにくさ ×（総当たり 1 回にかかる時間）で決まる。
 * PBKDF2 を 30 万回まわしているのは後者を稼ぐため。前者は人間の仕事。
 */

import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ITERATIONS = 300_000;
const passphrase = process.argv[2];

if (!passphrase) {
  console.error('使い方: node scripts/passphrase.mjs "あいことば"');
  process.exit(1);
}

const salt = randomBytes(16);
const digest = pbkdf2Sync(passphrase.normalize('NFKC'), salt, ITERATIONS, 32, 'sha256');

const body = `/**
 * 入口の合言葉。**生成物なので手で書き換えない。**
 *
 *   node scripts/passphrase.mjs "あたらしいあいことば"
 *
 * ここにあるのは合言葉そのものではなく、そこから一方向に作った値。
 * 合言葉を変えると digest が変わり、すでに解錠済みの端末も入口へ戻る。
 */

export const GATE = {
  salt: '${salt.toString('base64')}',
  iterations: ${ITERATIONS},
  digest: '${digest.toString('base64')}',
} as const;
`;

writeFileSync(resolve(import.meta.dirname, '..', 'src', 'gate.config.ts'), body, 'utf8');
console.log('src/gate.config.ts を更新した');
