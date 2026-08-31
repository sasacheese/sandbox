/**
 * 申込から、トークの一覧を組み立てる。
 *
 * 代理人のトークは**三つ同時に**始まっていて、進み方がずれている。ひとつは
 * すでに満了していて引き継げる、ひとつは途中、ひとつは始まったばかり。
 * 開いた瞬間に「勝手に進んでいる」と分かるのはこのずれのおかげで、
 * 一件ずつ順番に進めるより、放っておいたら増えていく感じが出る。
 *
 * 相手側の人間の判断も、ここで決めてしまう。**こちらが考え始める前から
 * 決まっている**という順序が、この作品の芯。
 */

import { closenessOf as closenessBase } from './closeness.ts';
import { COUNTERPARTS, LEAK_TEMPLATES, NOTES, PLAIN_THREADS, SCRIPT_SCALE } from './pools.ts';
import { isoTime, type Belief, type Handover, type Intake, type TheirDecision, type Thread } from './types.ts';

export type Rand = () => number;

/** 代理人のトークの本数と、それぞれの期間・進み具合。 */
const PLAN: readonly { days: number; progress: number }[] = [
  { days: 90, progress: 1 },
  { days: 62, progress: 0.55 },
  { days: 34, progress: 0.12 },
];

export function fabricationCount(persona: number): number {
  return Math.max(1, Math.min(3, 1 + Math.round(persona / 40)));
}

export function theirDecisionOf(rand: Rand): TheirDecision {
  const roll = rand();
  if (roll < 0.42) return 'inherit';
  if (roll < 0.72) return 'agent_only';
  return 'refuse';
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

function shuffled<T>(list: readonly T[], rand: Rand): T[] {
  return [...list].sort(() => rand() - 0.5);
}

/**
 * 自分のトーク。止まっているものが最初から並んでいる。
 *
 * 既読にしてから渡す。**自分の過去のやり取りは、もう読んでいる**ので、
 * ここに未読が付くのはおかしい。代理人のトークだけが未読で始まる——
 * こちらは一度も読んでいないから。
 */
export function buildPlainThreads(now: Date): Thread[] {
  return PLAIN_THREADS.map((seed) => ({
    id: seed.id,
    kind: 'plain',
    title: seed.name,
    createdAt: isoTime(now),
    headStart: 0,
    delta: 0,
    sent: [],
    answers: {},
    readAt: isoTime(now),
  }));
}

/** 代理人のトーク。三本、進み方をずらして始まっている。 */
export function buildProxyThreads(now: Date, rand: Rand): Thread[] {
  const seeds = shuffled(COUNTERPARTS, rand).slice(0, PLAN.length);
  return seeds.map((seed, index) => {
    const plan = PLAN[index] ?? PLAN[0];
    if (!plan) throw new Error('計画が空');
    return {
      id: `proxy-${seed.id}`,
      kind: 'proxy' as const,
      // 名前は最初から出す。伏せる制度上の理由が無い
      title: seed.name,
      seedId: seed.id,
      days: plan.days,
      createdAt: isoTime(now),
      headStart: Math.floor(plan.days * plan.progress),
      theirs: theirDecisionOf(rand),
      serial: serialOf(now, rand),
      delta: 0,
      sent: [],
      answers: {},
    };
  });
}

export function buildThreads(now: Date, rand: Rand): Thread[] {
  return [...buildProxyThreads(now, rand), ...buildPlainThreads(now)];
}

/**
 * 相手があなたについて信じていること。
 *
 * 作り話の数は「好かれやすさ」で増え、**代理人からの確認に答えるたびに減る**。
 * 答えれば事実に置き換わり、答えなければ代理人が埋めたままになる。
 */
function beliefsOf(fabrications: readonly string[], intake: Intake, answered: number, rand: Rand): Belief[] {
  const count = Math.max(0, fabricationCount(intake.persona) - answered);
  const made = shuffled(fabrications, rand)
    .slice(0, count)
    .map((text) => ({ text, fabricated: true }));
  return shuffled([...made, { text: `${intake.interest}に関心があること`, fabricated: false }], rand);
}

/**
 * 引継書。トークから開くときに、その場で組み立てる。
 *
 * 乱数は書類番号から作るので、**同じトークからは毎回同じ書類が出る**。
 * 読み直すたびに中身が変わる書類は書類ではない。
 */
export function buildHandover(thread: Thread, intake: Intake): Handover | null {
  const seed = COUNTERPARTS.find((c) => c.id === thread.seedId);
  if (!seed || thread.kind !== 'proxy') return null;
  const rand = seeded(thread.serial ?? thread.id);
  const days = thread.days ?? SCRIPT_SCALE;
  // 確認に答えたぶんだけ、作り話が減る
  const answered = Object.values(thread.answers).filter((a) => a !== 'skip').length;

  return {
    threadId: thread.id,
    serial: thread.serial ?? '—',
    days,
    name: seed.name,
    short: seed.short,
    dormant: seed.dormant,
    relation: seed.relation,
    calls: seed.callsOf(intake.name),
    closeness: closenessBase(days, intake.persona, rand),
    secret: seed.secret,
    beliefs: beliefsOf(seed.fabrications, intake, answered, rand),
    avoid: seed.avoid,
    joke: seed.joke,
    plans: seed.plans.map((p) => p.body),
    tally: {
      messages: seed.tally.messages,
      secrets: seed.tally.secrets,
      conflicts: seed.tally.conflicts,
      otherAgents: 18 + Math.floor(rand() * 40),
    },
    leaked: LEAK_TEMPLATES.map((template) =>
      template({ name: intake.name, interest: intake.interest, habit: intake.habit, avoid: intake.avoid }),
    ),
    notes: [...NOTES],
    theirs: thread.theirs ?? 'refuse',
  };
}

/** 文字列から作る乱数。同じ書類番号からは必ず同じ並びが出る。 */
export function seeded(key: string): () => number {
  let state = 0;
  for (const ch of key) state = (state * 31 + (ch.codePointAt(0) ?? 0)) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
