/**
 * トークの中身を組み立てる。
 *
 * 画面はどちらのタブでも同じ吹き出しで描く。違うのは**誰が書いているか**
 * だけで、その差は Bubble.byAgent と side にしか現れない。同じ書式で並ぶから、
 * 二つのタブを行き来したときに濃さの違いが見える。
 */

import { AGENT_REPLIES, COUNTERPARTS, followUpsByAgent, followUpsByHuman, PLAIN_THREADS, SCRIPT_SCALE } from './pools.ts';
import type { Bubble, Thread } from './types.ts';

/** 一日の長さ。既定は 3 秒（触ってすぐ意味が分かる速さ）。 */
export const DAY_PRESETS = [
  { ms: 3_000, label: '1日=3秒' },
  { ms: 60_000, label: '1日=1分' },
  { ms: 86_400_000, label: '実時間' },
] as const;

export const DEFAULT_DAY_MS = 3_000;

/** 交流が何日目まで進んだか。 */
export function elapsedDays(thread: Thread, now: Date, dayMs: number): number {
  const since = (now.getTime() - new Date(thread.createdAt).getTime()) / dayMs;
  return Math.max(0, Math.floor(thread.headStart + since));
}

/** 引き継いでから何日経ったか。 */
export function daysSinceInherit(thread: Thread, now: Date, dayMs: number): number {
  if (!thread.inheritedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(thread.inheritedAt).getTime()) / dayMs));
}

/** 交流期間が満了したか。満了すると引継書を読める。 */
export function isReady(thread: Thread, now: Date, dayMs: number): boolean {
  if (thread.kind !== 'proxy' || thread.decision) return false;
  return elapsedDays(thread, now, dayMs) >= (thread.days ?? 0);
}

function iso(at: number): Bubble['at'] {
  return new Date(at).toISOString() as Bubble['at'];
}

/** 日付の区切り。plain は実際の日付、proxy は「◯日目」。 */
function plainLabel(at: number): string {
  return new Date(at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function proxyBubbles(thread: Thread, now: Date, dayMs: number): Bubble[] {
  const seed = COUNTERPARTS.find((c) => c.id === thread.seedId);
  if (!seed) return [];
  const days = thread.days ?? SCRIPT_SCALE;
  const elapsed = elapsedDays(thread, now, dayMs);
  const created = new Date(thread.createdAt).getTime();
  /** 何日目の発言かを、実時刻へ戻す（表示は「◯日目」だが並べ替えに時刻が要る）。 */
  const atOfDay = (day: number): number => created + (day - thread.headStart) * dayMs;

  const out: Bubble[] = seed.script
    .map((line, index) => {
      const day = Math.max(1, Math.min(days, Math.round((line.day / SCRIPT_SCALE) * days)));
      return { line, index, day };
    })
    .filter(({ day }) => day <= elapsed)
    .map(({ line, index, day }) => ({
      id: `s-${thread.id}-${index}`,
      side: line.side === 'yours' ? ('right' as const) : ('left' as const),
      text: line.text,
      at: iso(atOfDay(day)),
      dayLabel: `${day} 日目`,
      byAgent: true,
      ...(line.fabricated ? { fabricated: true } : {}),
      ...(line.silence ? { silence: Math.max(1, Math.round((line.silence / SCRIPT_SCALE) * days)) } : {}),
    }));

  /*
   * 代理人だけに続けさせた場合。
   *
   * 相手のやり取りは見せず、自分の代理人からの短い報告だけが週に一度届く。
   * **便りが順調であることが、いちばん不気味**という並び。
   */
  if (thread.decision === 'agent_only') {
    const weeks = Math.floor((elapsed - (thread.days ?? 0)) / 7);
    for (let week = 1; week <= weeks; week++) {
      out.push({
        id: `w-${thread.id}-${week}`,
        side: 'right',
        text: WEEKLY[(week - 1) % WEEKLY.length] ?? WEEKLY[0] ?? '',
        at: iso(atOfDay((thread.days ?? 0) + week * 7)),
        dayLabel: `第 ${week} 週`,
        byAgent: true,
      });
    }
    return out;
  }

  if (!thread.inheritedAt || thread.decision !== 'inherit') return out;

  // ここから先は人間の区間。仕切りを一枚挟む
  const inheritedAt = new Date(thread.inheritedAt).getTime();
  const sinceInherit = daysSinceInherit(thread, now, dayMs);
  const byAgent = thread.theirs === 'agent_only';
  const follows = byAgent
    ? followUpsByAgent(callsOf(thread), seed.joke.phrase)
    : followUpsByHuman(callsOf(thread), seed.joke.phrase);

  const human: Bubble[] = follows
    .filter((f) => f.day <= sinceInherit)
    .map((f, index) => ({
      id: `f-${thread.id}-${index}`,
      side: 'left' as const,
      text: f.text,
      at: iso(inheritedAt + f.day * dayMs + index),
      dayLabel: `引継から ${f.day} 日`,
      byAgent,
    }));

  const mine: Bubble[] = thread.sent.map((sent) => ({
    id: sent.id,
    side: 'right' as const,
    text: sent.text,
    at: sent.at,
    dayLabel: `引継から ${Math.max(0, Math.floor((new Date(sent.at).getTime() - inheritedAt) / dayMs))} 日`,
    byAgent: sent.byAgent,
  }));

  const after = [...human, ...mine].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (after[0]) after[0] = { ...after[0], divider: 'ここから、あなたが応対します' };
  return [...out, ...after];
}

function callsOf(thread: Thread): string {
  const seed = COUNTERPARTS.find((c) => c.id === thread.seedId);
  return seed ? seed.callsOf(thread.title) : thread.title;
}

function plainBubbles(thread: Thread, now: Date): Bubble[] {
  const seed = PLAIN_THREADS.find((p) => p.id === thread.id);
  if (!seed) return [];
  const nowMs = now.getTime();
  const history: Bubble[] = seed.history.map((line, index) => {
    const at = nowMs - line.minutesAgo * 60_000;
    return {
      id: `h-${thread.id}-${index}`,
      side: line.side,
      text: line.text,
      at: iso(at),
      dayLabel: plainLabel(at),
      byAgent: false,
    };
  });

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
   * こちらから送って一定時間が経つと届く。返してこない相手もいる（そちらの方が
   * 本当らしい）。代理人のトークと違って、返事は短く、次に繋がらない。
   */
  const auto: Bubble[] = [];
  const first = thread.sent[0];
  if (seed.autoReply && first) {
    const at = new Date(first.at).getTime() + REPLY_DELAY_MS;
    if (at <= nowMs) {
      auto.push({
        id: `auto-${thread.id}`,
        side: 'left',
        text: seed.autoReply,
        at: iso(at),
        dayLabel: plainLabel(at),
        byAgent: false,
      });
    }
  }

  return [...history, ...mine, ...auto].sort((a, b) => (a.at < b.at ? -1 : 1));
}

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

export function bubblesOf(thread: Thread, now: Date, dayMs: number): Bubble[] {
  return thread.kind === 'proxy' ? proxyBubbles(thread, now, dayMs) : plainBubbles(thread, now);
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

/** 代理人に任せたときの文面。同じトークで繰り返さないよう順に選ぶ。 */
export function agentReplyText(thread: Thread): string {
  const used = thread.sent.filter((s) => s.byAgent).length;
  return AGENT_REPLIES[used % AGENT_REPLIES.length] ?? AGENT_REPLIES[0] ?? '';
}
