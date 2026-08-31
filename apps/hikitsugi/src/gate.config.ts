/**
 * 入口の合言葉。**生成物なので手で書き換えない。**
 *
 *   node scripts/passphrase.mjs "あたらしいあいことば"
 *
 * ここにあるのは合言葉そのものではなく、そこから一方向に作った値。
 * 合言葉を変えると digest が変わり、すでに解錠済みの端末も入口へ戻る。
 */

export const GATE = {
  salt: 'ZTq3m/NwvD6cS8N9aJ2G+A==',
  iterations: 300000,
  digest: 'V1anLYSmS3AD6R/Kx9xfsvjGwcaPumkj/FYjDNfs7uo=',
} as const;
