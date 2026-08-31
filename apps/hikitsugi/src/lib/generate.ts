/**
 * 取り込んだ履歴と実演の時間割から、トークの一覧を組み立てる。
 *
 * **トークは保存しない。**保存するのは取り込んだ過去ログと、本人が触った跡
 * （打った文・確認への答え・判断・既読）だけ。いま何周目のどこにいるかを出して、
 * その時点で現れているぶんを毎回作る。
 *
 * 相手側の人間の判断も、ここで決めてしまう。**こちらが考え始める前から
 * 決まっている**という順序が、この作品の芯。
 */

import { closenessOf as closenessBase } from './closeness.ts';
import { loopAt, plansAt, type Plan } from './loop.ts';
import { AUTO_REPLIES, NOTES, SCRIPT_SCALE, seedOfName, type Source } from './pools.ts';
import { DEFAULT_GAP_MS } from './threads.ts';
import { digestOf, habitsOf, type Transcript } from './transcript.ts';
import {
  isoTime,
  type Belief,
  type Handover,
  type Intake,
  type TheirDecision,
  type Thread,
  type ThreadState,
} from './types.ts';

export type Rand = () => number;

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

/** 名前から、保存や参照に使える id を作る。 */
export function idOfName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_000_007;
  return `p${hash.toString(36)}`;
}

/**
 * 自分のトーク。取り込んだ履歴がそのまま並ぶ。**止まっている。**
 *
 * 既読で渡す。自分の過去のやり取りに未読が付くのはおかしい。代理のトークだけが
 * 未読で始まる——こちらは一度も読んでいないから。
 */
export function buildPlainThreads(transcripts: readonly Transcript[], loopStart: number): Thread[] {
  return transcripts.map((transcript) => ({
    id: `talk-${idOfName(transcript.name)}`,
    kind: 'plain' as const,
    title: transcript.name,
    createdAt: isoTime(new Date(loopStart)),
    headStart: 0,
    gapMs: DEFAULT_GAP_MS,
    posts: 0,
    history: [...transcript.messages],
    delta: 0,
    sent: [],
    answers: {},
    readAt: isoTime(new Date(loopStart)),
  }));
}

/**
 * 代理のトーク一本。
 *
 * 書類番号と相手側の判断は「相手 × 何周目」から作るので、同じ一周のあいだは
 * 何度組み立てても同じものが出る。読み直すたびに相手の判断が変わる書類は
 * 書類ではない。
 */
export function buildProxyThread(plan: Plan, loopIndex: number, loopStart: number, history: readonly Transcript['messages'][number][]): Thread {
  const rand = seeded(`${plan.seed.id}#${loopIndex}`);
  const createdAt = new Date(loopStart + plan.appearsAt);
  return {
    id: `proxy-${plan.seed.id}`,
    kind: 'proxy' as const,
    title: plan.seed.name,
    seedId: plan.seed.id,
    days: plan.slot.days,
    createdAt: isoTime(createdAt),
    headStart: plan.headStart,
    gapMs: plan.gapMs,
    posts: plan.posts,
    history: [...history],
    theirs: theirDecisionOf(rand),
    serial: serialOf(createdAt, rand),
    delta: 0,
    sent: [],
    answers: {},
  };
}

/**
 * その時点で現れている代理のトーク。**放っておくと増える。**
 *
 * 取り込んだ履歴に無い相手のぶんは作らない。**代理は、過去ログのある相手に
 * しか出せない。**
 */
export function buildProxyThreads(now: Date, transcripts: readonly Transcript[], startedAt: number, loopMs: number): Thread[] {
  const { index, phase } = loopAt(now, startedAt, loopMs);
  const loopStart = startedAt + index * loopMs;
  return plansAt(phase, loopMs)
    .map((plan) => {
      const transcript = transcripts.find((t) => t.name === plan.seed.name);
      return transcript ? buildProxyThread(plan, index, loopStart, transcript.messages) : null;
    })
    .filter((thread): thread is Thread => thread !== null);
}

export function buildThreads(now: Date, transcripts: readonly Transcript[], startedAt: number, loopMs: number): Thread[] {
  const { index } = loopAt(now, startedAt, loopMs);
  const loopStart = startedAt + index * loopMs;
  return [...buildProxyThreads(now, transcripts, startedAt, loopMs), ...buildPlainThreads(transcripts, loopStart)];
}

/** 本人が触った跡を、組み立てたトークへ重ねる。 */
export function withState(thread: Thread, state: ThreadState | undefined): Thread {
  if (!state) return thread;
  return {
    ...thread,
    sent: state.sent,
    answers: state.answers,
    delta: state.delta,
    ...(state.decision ? { decision: state.decision } : {}),
    ...(state.inheritedAt ? { inheritedAt: state.inheritedAt } : {}),
    ...(state.readAt ? { readAt: state.readAt } : {}),
  };
}

/** その相手が、こちらの一通に一度だけ返してくるか。 */
export function autoReplyOf(name: string): string | undefined {
  return AUTO_REPLIES[name];
}

/**
 * 相手があなたについて信じていること。
 *
 * **出どころ別に並べる。**履歴から引いたものは引用が出せる。作り話は「推測」で、
 * 数は「好かれやすさ」で増え、**確認に答えるたびに減る**。
 */
function beliefsOf(
  seed: NonNullable<ReturnType<typeof seedOfName>>,
  transcript: Transcript | undefined,
  persona: number,
  answered: number,
  rand: Rand,
): Belief[] {
  const out: Belief[] = [];

  /*
   * 過去ログにそのまま書いてあったこと。
   *
   * **いちばん効くのはここ。**代理が作った話ではなく、本人が実際に打って、
   * そのままにした一文が、相手にとっての「あなた」になっている。
   */
  const quoted = transcript?.messages.filter((m) => m.mine && [...m.text].length >= 8) ?? [];
  const opening = quoted[0];
  const closing = quoted.at(-1);
  if (opening) out.push({ text: `あなたが「${trim(opening.text)}」と書く人であること`, source: 'history', from: opening.text });
  if (closing && closing !== opening) {
    out.push({ text: `「${trim(closing.text)}」と言ったまま、そのままにしていること`, source: 'history', from: closing.text });
  }

  // 答えた確認のぶん
  for (let i = 0; i < Math.min(answered, 2); i++) {
    const ask = seed.asks[i];
    if (ask) out.push({ text: ask.onYes.replace(/。$/, ''), source: 'you' });
  }

  // 残りが作り話
  const count = Math.max(0, fabricationCount(persona) - answered);
  for (const text of shuffled(seed.fabrications, rand).slice(0, count)) {
    out.push({ text, source: 'guess' });
  }
  return out;
}

function trim(text: string): string {
  const chars = [...text.replace(/\n/g, ' ')];
  return chars.length > 22 ? `${chars.slice(0, 22).join('')}…` : chars.join('');
}

/**
 * 引継書。トークから開くときに、その場で組み立てる。
 *
 * 乱数は書類番号から作るので、**同じトークからは毎回同じ書類が出る**。
 * 読み直すたびに中身が変わる書類は書類ではない。
 */
export function buildHandover(thread: Thread, intake: Intake, transcripts: readonly Transcript[], now: Date): Handover | null {
  const seed = seedOfName(thread.title);
  if (!seed || thread.kind !== 'proxy') return null;
  const transcript = transcripts.find((t) => t.name === thread.title);
  const digest = transcript ? digestOf(transcript, now) : null;
  const rand = seeded(thread.serial ?? thread.id);
  const days = thread.days ?? SCRIPT_SCALE;
  // 確認に答えたぶんだけ、作り話が減る
  const answered = Object.values(thread.answers).filter((a) => a !== 'guess').length;

  /*
   * 代理が外へ出した、あなたについての情報。
   *
   * **どれも過去ログを数えれば出る。**推測が混じっているのは最後の一件だけで、
   * それでも全部が当たっているように読めるのは、残りが計算だからだ。
   */
  const shared: Belief[] = [];
  const first = transcript?.messages.find((m) => m.mine);
  if (first) shared.push({ text: `あなたの書き方（例：「${trim(first.text)}」）`, source: 'history', from: first.text });
  for (const habit of transcript ? habitsOf(transcript) : []) shared.push({ text: habit, source: 'history' });
  // ひとつだけ、過去ログからは出てこないもの。**これを言えないと会話が始まらない**
  shared.push({ text: 'あなたがいま、連絡を取れる状態にあること', source: 'guess' });

  return {
    threadId: thread.id,
    serial: thread.serial ?? '—',
    days,
    name: seed.name,
    short: seed.short,
    relation: seed.relation,
    calls: seed.callsOf(intake.name),
    closeness: closenessBase(days, intake.persona, rand),
    quietDays: digest?.quietDays ?? 0,
    lastAt: digest?.lastAt ?? 0,
    logCount: digest?.count ?? 0,
    secret: seed.secret,
    beliefs: beliefsOf(seed, transcript, intake.persona, answered, rand),
    shared,
    avoid: seed.avoid,
    joke: seed.joke,
    plans: seed.plans.map((p) => p.body),
    tally: {
      messages: seed.tally.messages,
      secrets: seed.tally.secrets,
      conflicts: seed.tally.conflicts,
      otherAgents: 18 + Math.floor(rand() * 40),
    },
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

export type { Source };
