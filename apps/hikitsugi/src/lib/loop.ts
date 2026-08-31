/**
 * 実演の一巡。
 *
 * この作品は、開いて眺めているあいだに**代理人のやり取りが勝手に増えていく**
 * ところを見せないと伝わらない。かといって一本のトークが延々と続くわけでもない
 * ので、九本ぶんの台本を一巡のなかへ置き、順に現れ、順に満了し、出し切ったら
 * 最初へ戻る——という時間割にしてある。
 *
 * 時間割は**ループ全体に対する割合**で書く。一巡の長さ（30／45／60 分）を
 * 変えても、現れる順も混み具合も変わらず、投稿の間隔だけが伸び縮みする。
 *
 * - `at`   … 一覧に現れる位置（0 が一巡の頭）
 * - `head` … 現れた時点で交流がどこまで進んでいるか（1 なら満了済み）
 * - `days` … 交流期間。物語のうえでの長さで、実時間ではない
 * - `gap`  … 一通あたりの間隔。**トークごとにずらしてある**（揃うと画面が静かになる）
 *
 * 時刻は**一通ずつ等間隔**に振る。台本の日付どおりに流すと、日付が詰まった区間で
 * 二通が同時に出て、空いた区間で四十秒以上何も起きない（実際にそうなった）。
 * 相手は機械なのだから、等間隔に送り合うほうが理屈にも合う。
 */

import { COUNTERPARTS, SCRIPT_SCALE, type CounterpartSeed } from './pools.ts';

/** 一巡の長さ。既定は 30 分（いちばん賑やかに見える）。 */
export const LOOP_PRESETS = [
  { ms: 30 * 60_000, label: '30分' },
  { ms: 45 * 60_000, label: '45分' },
  { ms: 60 * 60_000, label: '60分' },
] as const;

export const DEFAULT_LOOP_MS = 30 * 60_000;

export type Slot = {
  seedId: string;
  at: number;
  head: number;
  days: number;
  gap: number;
};

/**
 * 時間割。
 *
 * 常に二〜三本が同時に動くように組んである。一本あたりは 15〜25 秒に一通で、
 * 間隔が互いに素なので画面全体では 8 秒に一通くらいになる。頭の三本は
 * すでに始まっていて、うち一本は満了済み——**開いた瞬間に引き継げるものが
 * 一件ある**状態から始めたいため。
 */
export const SLOTS: readonly Slot[] = [
  { seedId: 'sugano', at: 0.0, head: 1.0, days: 90, gap: 0.0097 },
  { seedId: 'komatsu', at: 0.0, head: 0.05, days: 62, gap: 0.011 },
  { seedId: 'arai', at: 0.02, head: 0.18, days: 74, gap: 0.0104 },
  { seedId: 'toda', at: 0.1, head: 0, days: 45, gap: 0.0091 },
  { seedId: 'sakurai', at: 0.17, head: 0, days: 120, gap: 0.0116 },
  { seedId: 'oikawa', at: 0.3, head: 0, days: 30, gap: 0.0085 },
  { seedId: 'sagara', at: 0.4, head: 0, days: 68, gap: 0.0111 },
  { seedId: 'hiranuma', at: 0.5, head: 0, days: 52, gap: 0.0105 },
  { seedId: 'shiraishi', at: 0.62, head: 0, days: 96, gap: 0.0111 },
];

export function seedOf(seedId: string): CounterpartSeed | undefined {
  return COUNTERPARTS.find((c) => c.id === seedId);
}

/** 台本の日付（90 日基準）を、このトークの期間へ縮める。 */
export function scaleDay(day: number, days: number): number {
  return Math.max(1, Math.min(days, Math.round((day / SCRIPT_SCALE) * days)));
}

/**
 * このトークが出す投稿の数。
 *
 * 確認は「札」と「代理人の応答」の二通として数える。`after` を渡すと、
 * その日より後に出るぶんだけ——つまり**これから目の前で出るぶん**を返す。
 */
export function postCount(seed: CounterpartSeed, days: number, after = 0): number {
  const lines = seed.script.filter((line) => scaleDay(line.day, days) > after).length;
  const asks = seed.asks.filter((ask) => scaleDay(ask.day, days) > after).length;
  return lines + asks * 2;
}

export type Plan = {
  slot: Slot;
  seed: CounterpartSeed;
  /** 現れた時点で進んでいた日数。ここまでのやり取りは、現れた時点で出揃っている。 */
  headStart: number;
  /** 現れてから満了までに出る投稿の数。 */
  posts: number;
  /** 一通から次の一通までの間（ミリ秒）。 */
  gapMs: number;
  /** 一覧に現れる時刻（一巡の頭からのミリ秒）。 */
  appearsAt: number;
  /** 満了する時刻（同）。 */
  endsAt: number;
};

/** 一本ぶんの時間割を解く。 */
export function planOf(slot: Slot, loopMs: number): Plan | null {
  const seed = seedOf(slot.seedId);
  if (!seed) return null;
  const headStart = Math.round(slot.days * slot.head);
  const posts = postCount(seed, slot.days, headStart);
  // 整数へ丸める。端数が残ると、出た通数が一通ぶん足りない瞬間が出る
  const gapMs = Math.round(slot.gap * loopMs);
  const appearsAt = Math.round(slot.at * loopMs);

  return { slot, seed, headStart, posts, gapMs, appearsAt, endsAt: appearsAt + posts * gapMs };
}

export function plans(loopMs: number): Plan[] {
  return SLOTS.map((slot) => planOf(slot, loopMs)).filter((plan): plan is Plan => plan !== null);
}

/** いま一巡の何周目・どこにいるか。 */
export function loopAt(now: Date, startedAt: number, loopMs: number): { index: number; phase: number } {
  const since = Math.max(0, now.getTime() - startedAt);
  return { index: Math.floor(since / loopMs), phase: since % loopMs };
}

/** その時点で一覧に出ているトーク。**放っておくと増える。** */
export function plansAt(phase: number, loopMs: number): Plan[] {
  return plans(loopMs).filter((plan) => plan.appearsAt <= phase);
}
