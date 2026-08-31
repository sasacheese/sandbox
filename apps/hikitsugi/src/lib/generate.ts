/**
 * 引継書を組み立てる。
 *
 * 乱数は外から渡す。読み直すたびに内容が変わる書類は書類ではないので、
 * 組み立ては一度だけ行い、結果をそのまま保存する。
 *
 * **相手側の人間の判断も、ここで決めてしまう。** 本人が引き継ぐかどうかを
 * 考え始める前から、向こうの答えは出ている——この順序が作品の芯なので、
 * あとから抽選するのではなく、発行の瞬間に確定させる。
 */

import { COUNTERPARTS, LEAK_TEMPLATES, NOTES, SCRIPT_SCALE, type CounterpartSeed } from './pools.ts';
import {
  isoTime,
  type Belief,
  type Counterpart,
  type Exchange,
  type Handover,
  type Intake,
  type Pledge,
  type TheirDecision,
} from './types.ts';

export type Rand = () => number;

function pick<T>(list: readonly T[], rand: Rand): T {
  const item = list[Math.floor(rand() * list.length)];
  if (item === undefined) throw new Error('空の候補から選ぼうとした');
  return item;
}

/**
 * 代理人同士の親密度。
 *
 * 人間相手の関係より高く出るようにしてある。代理人は返信が早く、相手の話を
 * 忘れず、いつでも都合がつく。**人間には勝てない条件で築かれた関係**を
 * 引き継ぐことになる、というのがこの数字の意味。上限は 95。
 */
export function closenessOf(days: number, persona: number, rand: Rand): number {
  const base = 48 + Math.min(days, 90) * 0.24 + persona * 0.16 + rand() * 6;
  return Math.max(40, Math.min(95, Math.round(base)));
}

/** 作り話の数は「好かれやすさ」で増える。申込画面ではそう言わない。 */
export function fabricationCount(persona: number): number {
  return Math.max(1, Math.min(3, 1 + Math.round(persona / 40)));
}

function beliefsOf(seed: CounterpartSeed, intake: Intake, rand: Rand): Belief[] {
  const made = [...seed.fabrications]
    .sort(() => rand() - 0.5)
    .slice(0, fabricationCount(intake.persona))
    .map((text) => ({ text, fabricated: true }));
  // 本当のことも同じ欄に混ざる。混ざっているから、どれが嘘か覚えていられない
  return [...made, { text: `${intake.interest}に関心があること`, fabricated: false }].sort(() => rand() - 0.5);
}

/** 台本の日付は 90 日を基準に書いてあるので、選ばれた期間へ縮める。 */
function exchangesOf(seed: CounterpartSeed, days: number): Exchange[] {
  return seed.script.map((line) => ({
    day: Math.max(1, Math.min(days, Math.round((line.day / SCRIPT_SCALE) * days))),
    side: line.side,
    text: line.text,
    ...(line.fabricated ? { fabricated: true } : {}),
    ...(line.silence ? { silence: Math.max(1, Math.round((line.silence / SCRIPT_SCALE) * days)) } : {}),
  }));
}

/**
 * 相手側の人間の判断。
 *
 * 「引き継ぐ」が最も多いが、半分には届かない。**引き継がれない可能性の方が
 * 高い**という設計で、そこで初めて「では代理人同士はどうなるのか」という
 * 問いが本人の側に立つ。
 */
export function theirDecisionOf(rand: Rand): TheirDecision {
  const roll = rand();
  if (roll < 0.42) return 'inherit';
  if (roll < 0.72) return 'agent_only';
  return 'refuse';
}

export function buildHandover(intake: Intake, now: Date, rand: Rand): Handover {
  const seed = pick(COUNTERPARTS, rand);
  const counterpart: Counterpart = {
    id: seed.id,
    alias: 'A',
    name: seed.name,
    relation: seed.relation,
    calls: seed.callsOf(intake.name),
    closeness: closenessOf(intake.days, intake.persona, rand),
    secret: seed.secret,
    beliefs: beliefsOf(seed, intake, rand),
    avoid: seed.avoid,
    joke: seed.joke,
  };

  const pledges: Pledge[] = seed.plans.map((plan, i) => ({
    id: `pledge-${seed.id}-${i}`,
    body: plan.body,
    dueDay: plan.dueDay,
    status: 'pending',
  }));

  const exchanges = exchangesOf(seed, intake.days);

  return {
    serial: serialOf(now, rand),
    issuedAt: isoTime(now),
    days: intake.days,
    counterpart,
    exchanges,
    tally: {
      // 台本は抜粋なので、実際のやり取りの件数は別に持つ
      messages: seed.tally.messages,
      secrets: seed.tally.secrets,
      conflicts: seed.tally.conflicts,
      plans: pledges.length,
      otherAgents: 18 + Math.floor(rand() * 40),
    },
    pledges,
    leaked: LEAK_TEMPLATES.map((template) =>
      template({ name: intake.name, interest: intake.interest, habit: intake.habit, avoid: intake.avoid }),
    ),
    notes: [...NOTES],
    theirs: theirDecisionOf(rand),
  };
}

const SERIAL_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function serialOf(now: Date, rand: Rand): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  let tail = '';
  for (let i = 0; i < 4; i++) tail += SERIAL_CHARS[Math.floor(rand() * SERIAL_CHARS.length)];
  return `RF-${y}${m}${d}-${tail}`;
}

/** 引き継ぎから何日経ったか。 */
export function daysSinceHandover(handover: Handover, now: Date, rate = 1): number {
  const ms = now.getTime() - new Date(handover.issuedAt).getTime();
  return Math.max(0, Math.floor((ms / 86_400_000) * rate));
}
