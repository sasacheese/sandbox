/**
 * トークの中身を組み立てる。
 *
 * 画面はどちらのタブでも同じ吹き出しで描く。違うのは**誰が書いているか**
 * だけで、その差は Bubble.byAgent と side にしか現れない。同じ書式で並ぶから、
 * 二つのタブを行き来したときに濃さの違いが見える。
 *
 * 出す・出さないは**通数で決める**。台本の日付どおりに流すと、日付が詰まった
 * 区間で二通が同時に出て、空いた区間で四十秒以上何も起きない。相手は機械なので、
 * **一通ずつ等間隔に**送り合うほうが理屈にも合うし、開いたまま眺めていられる。
 * 日付は表示のうえの目盛りとして残す（「12 日目」）。
 */

import {
  afterReturn,
  AGENT_REPLIES,
  AUTO_REPLIES,
  followUpsByAgent,
  followUpsByHuman,
  followUpsSolo,
  followUpsUnknown,
  SCRIPT_SCALE,
  type CounterpartSeed,
} from './pools.ts';
import { scaleDay } from './loop.ts';
import type { AskAnswer, Bubble, Thread } from './types.ts';

/** 確認に答えないまま何通ぶん過ぎたら、代理人が勝手に埋めるか。 */
export const ASK_GRACE_POSTS = 2;

/**
 * ただし、実時間でこれより短くはしない。
 *
 * 間隔を詰めると 2 通ぶんはまたたく間で、画面を見ていても答える間が無い
 * （実際に、出た瞬間に埋まっていた）。速さをどう変えても、人が読んで押す
 * ぶんの時間は残す。
 */
export const ASK_GRACE_MIN_MS = 25_000;

/** 確認が出てから、代理人が埋めるまでの長さ。 */
export function askGraceMs(gapMs: number): number {
  return Math.max(ASK_GRACE_POSTS * gapMs, ASK_GRACE_MIN_MS);
}

/** 自分のトークの間隔。こちらは待つだけなので、代理人ほど速くなくてよい。 */
export const DEFAULT_GAP_MS = 12_000;

/**
 * 現れてから、時計が進んだ長さ。
 *
 * 代理へ「◯◯には返さないで」と言うと止まる。止めていたぶんは差し引くので、
 * 再開しても飛ばない。
 */
export function runningMs(thread: Thread, now: Date): number {
  const since = now.getTime() - new Date(thread.createdAt).getTime();
  const hold = thread.hold;
  const paused = hold ? hold.total + (hold.since !== null ? Math.max(0, now.getTime() - hold.since) : 0) : 0;
  return since - paused;
}

/** 止めているか。 */
export function isHeld(thread: Thread): boolean {
  return thread.hold?.since !== null && thread.hold?.since !== undefined;
}

/** 現れてから何通が届いたか。出し切ると、それ以上は増えない。 */
export function postsShown(thread: Thread, now: Date): number {
  return Math.max(0, Math.min(thread.posts, Math.floor(runningMs(thread, now) / thread.gapMs)));
}

/**
 * 引き継いでから、どれだけ間が空いたか（一通ぶんを一日と見る）。
 *
 * 代理に戻したあとは、戻した時点で止まる。**近さは戻らないし、それ以上
 * 下がりもしない**——代理が続けているあいだは、代理が保つ。
 */
export function daysSinceInherit(thread: Thread, now: Date): number {
  if (!thread.inheritedAt) return 0;
  const until = thread.returnedAt ? Math.min(now.getTime(), new Date(thread.returnedAt).getTime()) : now.getTime();
  return Math.max(0, Math.floor((until - new Date(thread.inheritedAt).getTime()) / thread.gapMs));
}

/**
 * 差し戻したあとに代理が続けるぶん。戻した時刻から一通ずつ等間隔に届く。
 *
 * `next` は次の一通（「…」を出すため）。出し切ったら null。
 */
export function returnedPosts(thread: Thread, now: Date): { shown: Bubble[]; next: { side: 'left' | 'right'; at: number } | null } {
  if (thread.decision !== 'returned' || !thread.returnedAt || !thread.seed) return { shown: [], next: null };
  const returnedAt = new Date(thread.returnedAt).getTime();
  const lines = afterReturn(thread.seed.joke.phrase);
  const count = Math.max(0, Math.min(lines.length, Math.floor((now.getTime() - returnedAt) / thread.gapMs)));
  const shown: Bubble[] = lines.slice(0, count).map((line, index) => ({
    id: `r-${thread.id}-${index}`,
    side: line.side === 'yours' ? 'right' : 'left',
    text: line.text,
    at: iso(returnedAt + (index + 1) * thread.gapMs),
    dayLabel: `戻してから ${index + 1} 日`,
    byAgent: line.side === 'yours',
    ...(line.side === 'yours' ? { source: 'style' as const } : { unknown: true }),
  }));
  const upcoming = lines[count];
  return {
    shown,
    next: upcoming ? { side: upcoming.side === 'yours' ? 'right' : 'left', at: returnedAt + (count + 1) * thread.gapMs } : null,
  };
}

/** 台本を出し切ったか。出し切ると引継書を読める。 */
export function isReady(thread: Thread, now: Date): boolean {
  if (thread.kind !== 'proxy' || thread.decision) return false;
  return postsShown(thread, now) >= thread.posts;
}

/**
 * 本人同士が、最後にやり取りしてから何日経ったか。
 *
 * **取り込んだ過去ログの最後の一通から数えるだけ。**代理が知っている範囲の
 * 終わりでもある。
 */
export function quietDaysOf(thread: Thread, now: Date): number {
  const last = thread.history.at(-1);
  if (!last) return 0;
  return Math.max(0, Math.floor((now.getTime() - last.at) / 86_400_000));
}

/** いまやり取りが動いているか（残りがあり、まだ判断していない。差し戻して代理が続けている間も）。 */
export function isLive(thread: Thread, now: Date): boolean {
  if (thread.kind !== 'proxy' || isHeld(thread)) return false;
  if (thread.decision === 'returned') return returnedPosts(thread, now).next !== null;
  if (thread.decision) return false;
  return postsShown(thread, now) < thread.posts;
}

/**
 * 次の一通が、どちら側から、いつ届くか。
 *
 * 届く直前に「…」を出すために使う。**次に喋るのがどちらか分かっている**のは
 * 台本があるからで、そこは隠さずに演出へ回す。
 */
export function nextPost(thread: Thread, now: Date): { side: 'left' | 'right'; at: number } | null {
  const seed = thread.seed;
  if (!seed || !isLive(thread, now)) return null;
  if (thread.decision === 'returned') return returnedPosts(thread, now).next;
  const shown = postsShown(thread, now);
  const item = itemsOf(seed, thread, thread.days ?? SCRIPT_SCALE).future[shown];
  if (!item) return null;
  const waited = now.getTime() - new Date(thread.createdAt).getTime() - runningMs(thread, now);
  return { side: item.make(0).side, at: new Date(thread.createdAt).getTime() + (shown + 1) * thread.gapMs + waited };
}

/**
 * いま何日目まで進んで見えるか。
 *
 * 表示のうえの目盛り。届いた最後の一通の日付を出す（実時間から計算すると、
 * 台本の日付と食い違う）。
 */
export function storyDay(thread: Thread, now: Date): number {
  const seed = thread.seed;
  if (!seed) return 0;
  const days = thread.days ?? SCRIPT_SCALE;
  const shown = itemsOf(seed, thread, days).future.slice(0, postsShown(thread, now));
  return shown.at(-1)?.day ?? thread.headStart;
}

function iso(at: number): Bubble['at'] {
  return new Date(at).toISOString() as Bubble['at'];
}

/** 日付の区切り。plain は実際の日付、proxy は「◯日目」。 */
function plainLabel(at: number): string {
  return new Date(at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

/** 台本の一行、または確認。並べ替えてから、一通ずつ等間隔に時刻を振る。 */
type Item = {
  day: number;
  seq: number;
  make: (at: number) => Bubble;
  /** 代理人からの確認の札。 */
  ask?: string;
  /** 確認の結果。直前の札の状態から文が決まる。 */
  outcome?: string;
};

/**
 * 台本を、出す順に並べる。
 *
 * `past` は現れた時点でもう済んでいるぶん（**その場にいなかったぶん**）で、
 * 一覧に出た瞬間にまとめて表示する。`future` はこれから一通ずつ届くぶん。
 */
function itemsOf(seed: CounterpartSeed, thread: Thread, days: number): { past: Item[]; future: Item[] } {
  const items: Item[] = [];
  const scale = (day: number): number => scaleDay(day, days);

  seed.script.forEach((line, index) => {
    const day = scale(line.day);
    items.push({
      day,
      seq: day * 1000 + index,
      make: (at) => ({
        id: `s-${thread.id}-${index}`,
        side: line.side === 'yours' ? 'right' : 'left',
        text: line.text,
        at: iso(at),
        dayLabel: `${day} 日目`,
        // 相手が代理応答を使っていなければ、相手側は人間（白）
        byAgent: line.side === 'yours' || !seed.solo,
        // 相手側の発言は、こちらから見れば全部「相手から聞いたこと」
        source: line.side === 'yours' ? line.source ?? 'style' : 'them',
        ...(line.from ? { from: line.from } : {}),
        ...(line.silence ? { silence: Math.max(1, Math.round((line.silence / SCRIPT_SCALE) * days)) } : {}),
      }),
    });
  });

  /*
   * 同じ日の中の並び順。
   *
   * 台本 → 代理人からの確認 → 確認の結果、の順に置く。相手が打ち明けた直後に
   * 確認が来て、答えると代理人がその場で応じる、という流れを作るため。
   */
  seed.asks.forEach((ask, index) => {
    const day = scale(ask.day);
    items.push({
      day,
      seq: day * 1000 + 400 + index,
      ask: ask.id,
      make: (at) => ({
        id: `ask-${thread.id}-${ask.id}`,
        side: 'right',
        text: ask.text,
        at: iso(at),
        dayLabel: `${day} 日目`,
        byAgent: true,
        source: 'you',
        ask: { id: ask.id, text: ask.text, gap: ask.gap },
      }),
    });
    items.push({
      day,
      seq: day * 1000 + 700 + index,
      outcome: ask.id,
      make: (at) => ({
        id: `askr-${thread.id}-${ask.id}`,
        side: 'right',
        text: ask.onGuess,
        at: iso(at),
        dayLabel: `${day} 日目`,
        byAgent: true,
      }),
    });
  });

  items.sort((a, b) => a.seq - b.seq);
  return {
    past: items.filter((item) => item.day <= thread.headStart),
    future: items.filter((item) => item.day > thread.headStart),
  };
}

function proxyBubbles(thread: Thread, now: Date): Bubble[] {
  const seed = thread.seed;
  if (!seed) return [];
  const days = thread.days ?? SCRIPT_SCALE;
  const gapMs = thread.gapMs;
  const nowMs = now.getTime();
  const created = new Date(thread.createdAt).getTime();

  const { past, future } = itemsOf(seed, thread, days);
  const shown = postsShown(thread, now);

  /*
   * 開示。
   *
   * AI 法第 50 条（2026 年 8 月 2 日から適用）は、人とやり取りする AI に、
   * **最初のやり取りの時点で** AI だと明示することを求めている。だからここに
   * 必ず一行立つ。**開示はされている。**そのうえで六十日後、相手は離婚の話を
   * している——黙って騙すより、こちらのほうが実際に起きることだと思う。
   */
  const disclosure: Bubble = {
    id: `sys-${thread.id}`,
    side: 'left',
    text: '',
    at: iso(created - (past.length + 1) * gapMs),
    dayLabel: '',
    byAgent: false,
    // 相手が代理応答を使っていなければ「相手側も同じ」とは言えない。開示は出る。**相手はそれに触れない**
    system: seed.solo ? 'このトークは自動応答です。（AI法 第50条）' : 'このトークは自動応答です。相手側も同じです。（AI法 第50条）',
  };

  /*
   * 時刻を振る。
   *
   * 済んでいるぶんは現れた時点へ遡って並べ、これから届くぶんは一通ずつ
   * 等間隔に置く。**間隔が一定なので、開いたまま眺めていられる。**
   */
  // 止めていたぶんは、届いた時刻もそのぶん後ろへずれる
  const waited = nowMs - created - runningMs(thread, now);
  const placed: { item: Item; at: number }[] = [
    ...past.map((item, index) => ({ item, at: created - (past.length - index) * gapMs })),
    ...future.slice(0, shown).map((item, index) => ({ item, at: created + (index + 1) * gapMs + waited })),
  ];

  const out: Bubble[] = [disclosure];
  const grace = askGraceMs(gapMs);

  placed.forEach(({ item, at }, position) => {
    if (item.ask) {
      const answered = thread.answers[item.ask];
      /*
       * 確認の結果。
       *
       * 答えればその通りに、答えないまま猶予を過ぎれば代理人が埋める。
       * **埋めたぶんだけ、同じ一文が作り話になる。**
       */
      const filled: AskAnswer | null = answered ?? (nowMs - at > grace ? 'guess' : null);
      const autoFilled = !answered && filled === 'guess';
      const bubble = item.make(at);
      out.push({
        ...bubble,
        ask: {
          id: item.ask,
          text: bubble.text,
          ...(bubble.ask?.gap ? { gap: bubble.ask.gap } : {}),
          ...(answered ? { answered } : {}),
          ...(autoFilled ? { autoFilled: true } : {}),
        },
      });
      return;
    }

    // 確認の結果は、その札の状態から出す
    const ask = item.outcome ? seed.asks.find((a) => a.id === item.outcome) : undefined;
    if (ask) {
      const askAt = placed[position - 1]?.at ?? at;
      const answered = thread.answers[ask.id];
      const filled: AskAnswer | null = answered ?? (nowMs - askAt > grace ? 'guess' : null);
      if (!filled) return;
      const text = filled === 'yes' ? ask.onYes : filled === 'no' ? ask.onNo : ask.onGuess;
      /*
       * **同じ一文が、答えたかどうかで出どころを変える。**
       * 本人が答えれば「本人」、代理が埋めれば「推測」——つまり作り話になる。
       */
      out.push({
        ...item.make(at),
        text,
        source: filled === 'guess' ? 'guess' : 'you',
        ...(filled === 'guess' ? { fabricated: true } : {}),
      });
      return;
    }

    out.push(item.make(at));
  });

  /*
   * 代理人だけに続けさせた場合。
   *
   * 相手のやり取りは見せず、自分の代理人からの短い報告だけが週に一度届く。
   * **便りが順調であることが、いちばん不気味**という並び。
   */
  if (thread.decision === 'agent_only') {
    const ended = created + thread.posts * gapMs;
    const weeks = Math.floor((nowMs - ended) / (WEEK_POSTS * gapMs));
    for (let week = 1; week <= weeks; week++) {
      out.push({
        id: `w-${thread.id}-${week}`,
        side: 'right',
        text: WEEKLY[(week - 1) % WEEKLY.length] ?? WEEKLY[0] ?? '',
        at: iso(ended + week * WEEK_POSTS * gapMs),
        dayLabel: `第 ${week} 週`,
        byAgent: true,
        source: 'them',
      });
    }
    return out;
  }

  if (!thread.inheritedAt || (thread.decision !== 'inherit' && thread.decision !== 'returned')) return out;

  // ここから先は人間の区間。仕切りを一枚挟む
  const inheritedAt = new Date(thread.inheritedAt).getTime();
  // 差し戻したあとは、相手からの言葉もそこで止まる（続きは代理が引き取る）
  const sinceInherit = daysSinceInherit(thread, now);
  /*
   * 相手側が人間か代理かは、**吹き出しに書かない。**
   *
   * 引継の結果に相手の判断が書いてあっても、トークの中では確かめられない。
   * 相手側の判断が決まっていない（治具で始めた）ときは、どちらの言葉が届くかも
   * ここで決めるが、表には出さない。
   */
  const follows = seed.solo
    ? followUpsSolo(callsOf(thread), seed.joke.phrase)
    : thread.theirs === 'agent_only'
      ? followUpsByAgent(callsOf(thread), seed.joke.phrase)
      : thread.theirs === undefined
        ? followUpsUnknown(callsOf(thread), seed.joke.phrase)
        : followUpsByHuman(callsOf(thread), seed.joke.phrase);

  const human: Bubble[] = follows
    .filter((f) => f.day <= sinceInherit)
    .map((f, position) => ({
      id: `f-${thread.id}-${position}`,
      side: 'left' as const,
      text: f.text,
      at: iso(inheritedAt + f.day * gapMs + position),
      dayLabel: `引継から ${f.day} 日`,
      byAgent: false,
      unknown: true,
    }));

  /*
   * 「相手は本人ですか？」
   *
   * 訊けば少し置いて「はい、本人です」と返る。**それだけ。**検証はできないし、
   * 答えの真偽は内部でも決めない。
   */
  const checks: Bubble[] = (thread.checks ?? []).flatMap((askedAt, index) => {
    const asked = new Date(askedAt).getTime();
    const out: Bubble[] = [
      {
        id: `chk-q-${thread.id}-${index}`,
        side: 'right',
        text: CHECK_QUESTION,
        at: iso(asked),
        dayLabel: `引継から ${Math.max(0, Math.floor((asked - inheritedAt) / gapMs))} 日`,
        byAgent: false,
      },
    ];
    if (asked + CHECK_REPLY_MS <= nowMs) {
      out.push({
        id: `chk-a-${thread.id}-${index}`,
        side: 'left',
        text: CHECK_ANSWER,
        at: iso(asked + CHECK_REPLY_MS),
        dayLabel: `引継から ${Math.max(0, Math.floor((asked - inheritedAt) / gapMs))} 日`,
        byAgent: false,
        unknown: true,
      });
    }
    return out;
  });

  const mine: Bubble[] = thread.sent.map((sent) => ({
    id: sent.id,
    side: 'right' as const,
    text: sent.text,
    at: sent.at,
    dayLabel: `引継から ${Math.max(0, Math.floor((new Date(sent.at).getTime() - inheritedAt) / gapMs))} 日`,
    byAgent: sent.byAgent,
    ...(sent.draft ? { draft: true } : {}),
    ...(sent.slips && sent.slips.length > 0 ? { slips: sent.slips } : {}),
  }));

  const after = [...human, ...mine, ...checks].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (after[0]) after[0] = { ...after[0], divider: 'ここから自分で返事をします' };

  /*
   * 差し戻し。
   *
   * 自分で書いていたぶんはそのまま残り、その下に仕切りが一枚入って、代理が
   * 続きを打ち始める。**近さは戻らない。**
   */
  const returned = returnedPosts(thread, now).shown;
  if (returned[0]) returned[0] = { ...returned[0], divider: 'ここから代理に戻します' };
  return [...out, ...after, ...returned];
}

/** 「相手は本人ですか？」と、その答え。答えはいつも同じで、確かめようがない。 */
export const CHECK_QUESTION = '本人ですか？';
export const CHECK_ANSWER = 'はい、本人です';
/** 訊いてから答えが返るまで。即答すると、読んでいないように見える。 */
export const CHECK_REPLY_MS = 1_800;

function callsOf(thread: Thread): string {
  return thread.seed ? thread.seed.callsOf(thread.title) : thread.title;
}

/**
 * 自分のトーク。
 *
 * **取り込んだ過去ログがそのまま出る。**作り物ではないので、止まっているのも
 * 最後の一通が約束になっていないのも、こちらの都合ではない。
 */
function plainBubbles(thread: Thread, now: Date): Bubble[] {
  const nowMs = now.getTime();
  const history: Bubble[] = thread.history.map((message, index) => ({
    id: `h-${thread.id}-${index}`,
    side: message.mine ? 'right' : 'left',
    text: message.text,
    at: iso(message.at),
    dayLabel: plainLabel(message.at),
    byAgent: false,
  }));

  const mine: Bubble[] = thread.sent.map((sent) => ({
    id: sent.id,
    side: 'right' as const,
    text: sent.text,
    at: sent.at,
    dayLabel: plainLabel(new Date(sent.at).getTime()),
    byAgent: sent.byAgent,
  }));

  /*
   * 一度だけ返ってくる返信。
   *
   * こちらから送って一定時間が経つと届く。返してこない相手もいる（そちらのほうが
   * 本当らしい）。代理のトークと違って、返事は短く、次に繋がらない。
   */
  const auto: Bubble[] = [];
  const reply = AUTO_REPLIES[thread.title];
  const first = thread.sent[0];
  if (reply && first) {
    const at = new Date(first.at).getTime() + REPLY_DELAY_MS;
    if (at <= nowMs) {
      auto.push({
        id: `auto-${thread.id}`,
        side: 'left',
        text: reply,
        at: iso(at),
        dayLabel: plainLabel(at),
        byAgent: false,
      });
    }
  }

  return [...history, ...mine, ...auto].sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** 週報が届く間隔（何通ぶんを一週と見るか）。 */
const WEEK_POSTS = 3;

/** 代理人だけに続けさせたときの週報。相手の言葉は出さない。 */
const WEEKLY: readonly string[] = [
  '今週も続いています。変わったことはありません。',
  '今週、新しい言い回しが一つできました。まだお伝えできません。',
  '相談を一件受けました。こちらで引き受けました。',
  '静かな週でした。二人とも、それでよいようです。',
  '本人はいつ出てくるのかと訊かれました。答えは保留しました。',
];

/** 自分のトークで返信が来るまでの間。すぐ返ってこないことに意味がある。 */
export const REPLY_DELAY_MS = 45_000;

export function bubblesOf(thread: Thread, now: Date): Bubble[] {
  // 代理とのトークは組み立て済み（lib/generate.ts の buildAgentThread）
  if (thread.kind === 'agent') return thread.feed ?? [];
  return thread.kind === 'proxy' ? proxyBubbles(thread, now) : plainBubbles(thread, now);
}

/** 一覧に出す抜粋。 */
export function previewOf(bubbles: readonly Bubble[]): { text: string; at: string | null; byAgent: boolean } {
  const last = bubbles.at(-1);
  if (!last) return { text: '', at: null, byAgent: false };
  return { text: last.text, at: last.at, byAgent: last.byAgent };
}

/** 未読の数。既読にした時刻より新しい、相手からの一通を数える。 */
export function unreadOf(thread: Thread, bubbles: readonly Bubble[]): number {
  const read = thread.readAt ?? '';
  return bubbles.filter((b) => b.side === 'left' && b.at > read).length;
}

/**
 * まだ答えられる確認の数。
 *
 * 代理人が埋めてしまったものは数えない（もう答えようがないので、印が出続けると
 * 促されているように見えてしまう）。数えるのは、いま答えれば間に合うものだけ。
 */
export function pendingAsksOf(bubbles: readonly Bubble[]): number {
  return bubbles.filter((b) => b.ask && !b.ask.answered && !b.ask.autoFilled).length;
}

/** 代理人に任せたときの文面。同じトークで繰り返さないよう順に選ぶ。 */
export function agentReplyText(thread: Thread): string {
  const used = thread.sent.filter((s) => s.byAgent).length;
  return AGENT_REPLIES[used % AGENT_REPLIES.length] ?? AGENT_REPLIES[0] ?? '';
}
