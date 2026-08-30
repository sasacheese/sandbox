/**
 * 入口の合言葉。**生成物なので手で書き換えない。**
 *
 *   node scripts/passphrase.mjs "あたらしいあいことば"
 *
 * ここにあるのは合言葉そのものではなく、そこから一方向に作った値。
 * 合言葉を変えると digest が変わり、すでに解錠済みの端末も入口へ戻る。
 */

export const GATE = {
  salt: '9LKkgsTW+7K1qI9B3HLQ3g==',
  iterations: 300000,
  digest: 'jR2L7c38e2UXY887Hq5W0ji9yriXaXtBbuQGHZeFc4M=',
} as const;
