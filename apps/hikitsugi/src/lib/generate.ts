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
import { loopAt, plans, type Plan } from './loop.ts';
import { AUTO_REPLIES, COUNTERPARTS, NOTES, SCRIPT_SCALE, type CounterpartSeed, type Source } from './pools.ts';
import { SAYS } from './agent.ts';
import { askGraceMs, bubblesOf, DEFAULT_GAP_MS, isReady } from './threads.ts';
import { digestOf, habitsOf, type Message, type Transcript } from './transcript.ts';
import {
  isoTime,
  type Belief,
  type Bubble,
  type Handover,
  type Intake,
  type IsoTime,
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
/** 止めているあいだの記録。相手の名前で引く。 */
export type Holds = Record<string, { since: number | null; total: number }>;

/**
 * 引き継いだ状態から始めた印。相手の id で引く。
 *
 * 設定のデモ用設定から使う治具。引き継いだ後を一回試すのに一周待たなくて
 * よいようにするためのもので、跳んだ時刻を持つ。一周が終わると消える。
 */
export type Jumps = Record<string, IsoTime>;

export function buildProxyThread(
  plan: Plan,
  loopIndex: number,
  loopStart: number,
  history: readonly Message[],
  hold?: Holds[string],
  jumpedAt?: IsoTime,
): Thread {
  const rand = seeded(`${plan.seed.id}#${loopIndex}`);
  /*
   * 跳んだトークは、跳んだ瞬間に出し切っているように現れた時刻を遡らせる。
   * 相手側の判断は決めない（**未確定**）——引継書を通らずに引き継いだので、
   * 相手が何を選んだかを見る機会が無い。
   */
  const createdAt = jumpedAt ? new Date(new Date(jumpedAt).getTime() - plan.posts * plan.gapMs) : new Date(loopStart + plan.appearsAt);
  return {
    id: `proxy-${plan.seed.id}`,
    kind: 'proxy' as const,
    title: plan.seed.name,
    seedId: plan.seed.id,
    seed: plan.seed,
    ...(hold ? { hold } : {}),
    days: plan.slot.days,
    createdAt: isoTime(createdAt),
    headStart: plan.headStart,
    gapMs: plan.gapMs,
    posts: plan.posts,
    history: [...history],
    ...(jumpedAt ? {} : { theirs: theirDecisionOf(rand) }),
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
export function buildProxyThreads(
  now: Date,
  transcripts: readonly Transcript[],
  startedAt: number,
  loopMs: number,
  seeds: readonly CounterpartSeed[] = COUNTERPARTS,
  holds: Holds = {},
  jumps: Jumps = {},
): Thread[] {
  const { index, phase } = loopAt(now, startedAt, loopMs);
  const loopStart = startedAt + index * loopMs;
  // 跳んだ相手は、まだ現れる番でなくても出す
  const due = plans(loopMs, seeds).filter((plan) => plan.appearsAt <= phase || jumps[plan.seed.id]);
  return due
    .map((plan) => {
      const transcript = transcripts.find((t) => t.name === plan.seed.name);
      return transcript ? buildProxyThread(plan, index, loopStart, transcript.messages, holds[plan.seed.name], jumps[plan.seed.id]) : null;
    })
    .filter((thread): thread is Thread => thread !== null);
}

/**
 * 自分の代理とのトーク。一件だけ。
 *
 * 中身は二つが混ざる。
 *
 * 1. **保存してあるもの**——こちらの指示と、それへの返事
 * 2. **他のトークの状態から毎回組み立てるもの**——代理が自分から言ってくること。
 *    声をかけた報告、「これ言っていい？」の確認、返事が無くて勝手に言った報告、
 *    一区切りついた報告
 *
 * 確認は、相手のトークにある同じ札と一つのもの。ここで答えれば向こうも埋まる。
 * **一周が終わっても 1. は消えない**——指示は本人の意思なので、進行と一緒に流さない。
 */
export function buildAgentThread(log: readonly Message[], loopStart: number, proxies: readonly Thread[] = [], now: Date = new Date()): Thread {
  const feed: Bubble[] = log.map((message, index) => ({
    id: `a-${index}`,
    side: message.mine ? 'right' : 'left',
    text: message.text,
    at: isoTime(new Date(message.at)),
    dayLabel: dayOf(message.at),
    byAgent: !message.mine,
    ...(message.mine ? {} : { source: 'them' as const }),
  }));

  for (const thread of proxies) {
    if (!thread.seed) continue;
    const bubbles = bubblesOf(thread, now);
    const first = bubbles.find((b) => !b.system);
    if (!first) continue;
    const say = (id: string, at: string, text: string, extra: Partial<Bubble> = {}): Bubble => ({
      id: `${id}-${thread.id}`,
      side: 'left',
      text,
      at: at as Bubble['at'],
      dayLabel: dayOf(new Date(at).getTime()),
      byAgent: true,
      source: 'them',
      ...extra,
    });

    feed.push(say('start', first.at, SAYS.started(thread.title)));

    for (const bubble of bubbles) {
      if (!bubble.ask) continue;
      const ask = thread.seed.asks.find((a) => a.id === bubble.ask?.id);
      if (!ask) continue;
      if (bubble.ask.autoFilled) {
        // 答えが無くて、代理が勝手に言った。そのことは言ってくる
        const at = new Date(new Date(bubble.at).getTime() + askGraceMs(thread.gapMs)).toISOString();
        feed.push(say(`guessed-${ask.id}`, at, SAYS.guessed(thread.title, ask.onGuess)));
        continue;
      }
      // まだ答えられる（あるいは答えた）確認。友達の口調で訊く
      feed.push(
        say(`ask-${ask.id}`, bubble.at, ask.chat ?? ask.text, {
          ask: { ...bubble.ask, text: ask.chat ?? ask.text, threadId: thread.id },
        }),
      );
    }

    if (isReady(thread, now) || thread.decision) {
      const last = bubbles.at(-1);
      if (last) feed.push(say('done', new Date(new Date(last.at).getTime() + thread.gapMs).toISOString(), SAYS.done(thread.title)));
    }
  }

  feed.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  // 未来の時刻のものは出さない（一区切りの報告は最後の一通の少し後に置くため）
  const visible = feed.filter((b) => new Date(b.at).getTime() <= now.getTime());

  return {
    id: 'agent',
    kind: 'agent',
    title: '代理',
    createdAt: isoTime(new Date(loopStart)),
    headStart: 0,
    gapMs: DEFAULT_GAP_MS,
    posts: 0,
    history: [...log],
    feed: visible,
    delta: 0,
    sent: [],
    answers: {},
  };
}

function dayOf(at: number): string {
  return new Date(at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function buildThreads(
  now: Date,
  transcripts: readonly Transcript[],
  startedAt: number,
  loopMs: number,
  seeds: readonly CounterpartSeed[] = COUNTERPARTS,
  holds: Holds = {},
  agentLog: readonly Message[] = [],
  jumps: Jumps = {},
): Thread[] {
  const { index } = loopAt(now, startedAt, loopMs);
  const loopStart = startedAt + index * loopMs;
  const proxies = buildProxyThreads(now, transcripts, startedAt, loopMs, seeds, holds, jumps);
  return [buildAgentThread(agentLog, loopStart, proxies, now), ...proxies, ...buildPlainThreads(transcripts, loopStart)];
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
  seed: CounterpartSeed,
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
export function buildHandover(
  thread: Thread,
  intake: Intake,
  transcripts: readonly Transcript[],
  now: Date,
  rules: readonly { kind: string; target?: string; text: string }[] = [],
): Handover | null {
  const seed = thread.seed;
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
    // 本人が代理へ言った申し送りは、注意事項の末尾に載る
    notes: [
      ...NOTES,
      ...rules.filter((r) => r.kind === 'note' && (!r.target || r.target === seed.name)).map((r) => `本人からの申し送り：「${r.text}」`),
    ],
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
