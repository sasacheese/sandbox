/**
 * 入口の合言葉。**生成物なので手で書き換えない。**
 *
 *   node scripts/passphrase.mjs "あたらしいあいことば"
 *
 * ここにあるのは合言葉そのものではなく、そこから一方向に作った値。
 * 合言葉を変えると digest が変わり、すでに解錠済みの端末も入口へ戻る。
 */

export const GATE = {
  salt: 'MXSarZCErM5LULsS9keUHQ==',
  iterations: 300000,
  digest: 't6jSxkn4HRNINXbT3qIALAKyswfyn3HCYQK/U1IA/bk=',
} as const;
