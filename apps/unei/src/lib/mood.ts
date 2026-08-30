/**
 * 機嫌。コミュニティ全員で共有される、ただ一つの数値。
 *
 * 下がると何が起きるか——**何も起きない。ただ下がる。**罰も報酬も無い。
 * Reddit の The Button（押さないと終わる 60 秒のカウントダウンだけの装置に
 * 100 万人が張りついた）が示したのは、共同体が一つの状態を共有していること
 * 自体が人を動かす、ということだった。それをそのまま借りている。
 *
 * 保存するのは「ある時刻の値」で、現在値は経過から毎回計算する。数値を
 * 定期的に書き換える作りにすると、アプリを開いていない間の時間が消える。
 */

import { MOOD_DECAY_PER_HOUR, MOOD_MAX, MOOD_MIN, isoTime, type Realm } from './types.ts';

/** 経過ぶん減らした現在の機嫌。rate は時間の倍率（展示用の早送り）。 */
export function moodNow(realm: Realm, now: Date, rate = 1): number {
  const hours = Math.max(0, (now.getTime() - new Date(realm.moodAt).getTime()) / 3_600_000) * rate;
  return clamp(realm.mood - hours * MOOD_DECAY_PER_HOUR);
}

export function clamp(value: number): number {
  return Math.min(MOOD_MAX, Math.max(MOOD_MIN, Math.round(value)));
}

/** 現在値を確定させたうえで増減する。減衰の起点も今に置き直す。 */
export function shiftMood(realm: Realm, delta: number, now: Date, rate = 1): Realm {
  return { ...realm, mood: clamp(moodNow(realm, now, rate) + delta), moodAt: isoTime(now) };
}

/** 機嫌の段。色や文言を切り替えるのに使う。 */
export type MoodTier = 'high' | 'mid' | 'low' | 'dying';

export function moodTier(value: number): MoodTier {
  if (value >= 70) return 'high';
  if (value >= 40) return 'mid';
  if (value >= 12) return 'low';
  return 'dying';
}

/** 機嫌の説明。運営は自分の状態を説明しないので、これは参加者側の観測にあたる。 */
export const MOOD_LABEL: Record<MoodTier, string> = {
  high: '運営は満ちている',
  mid: '運営は静かである',
  low: '運営は退屈している',
  dying: '運営は応答を必要としている',
};
