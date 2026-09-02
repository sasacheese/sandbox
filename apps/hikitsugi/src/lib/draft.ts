/**
 * 代理の下書き。
 *
 * 引き継いだトークで自分が打つとき、入力欄の上に**代理ならこう打った**を出す。
 * 触ればそのまま送れるし、無視して自分で打ってもいい。下書きで送れば近さは
 * 保たれ、自分で打てば下がる——**自分の言葉を使うほど、関係は自分のものに
 * なっていくのに、数字は下がる**という並び。
 *
 * モデルは呼ばない。相手から届いた一通に対する返し方の型と、そのトークの内輪の
 * 言い回し・約束、それに過去ログから数えたあなたの書き方（句点・長さ）だけで作る。
 * 代理が知っている範囲の外へは出ない。
 */

import { AGENT_REPLIES } from './pools.ts';
import type { Tone } from './transcript.ts';
import type { Bubble, Thread } from './types.ts';

export const DRAFT_LABEL = '代理ならこう打った';

/**
 * 相手から届いた一通への返し方。引き継いだあと相手が言ってくることは五つ
 * （lib/pools.ts の followUps）で、その順番と対応している。
 */
function replyTo(position: number, joke: string): readonly string[] {
  switch (position) {
    case 0:
      return ['はい。', 'お待たせしました。'];
    case 1:
      return [`${joke}。`, '覚えています。'];
    case 2:
      return ['聞きます。', '急がなくていいです。'];
    case 3:
      return ['有効です。', '日付を決めましょう。'];
    case 4:
      return ['そうかもしれません。', '悪い意味でないなら、よかった。'];
    default:
      return ['受け取りました。', '続きを聞かせてください。'];
  }
}

/** 相手からまだ何も来ていないとき。 */
const OPENING: readonly string[] = ['ここからは私が書きます。', '続きを聞かせてください。'];

/**
 * 句点と長さを、あなたの書き方へ寄せる。
 *
 * 句点を打たない人なら、文の切れ目は改行になる。一通が短い人なら、最初の
 * 一文だけにする。**引継書の「代理が外へ出した情報」と同じ癖**で書く。
 */
export function shapeTo(sentences: readonly string[], tone: Tone | null): string {
  const picked = tone && tone.avgLength < 12 ? sentences.slice(0, 1) : sentences;
  if (!tone || tone.period) return picked.join('');
  return picked.map((s) => s.replace(/[。．]$/, '')).join('\n');
}

/**
 * いま出す下書き。
 *
 * 相手から届いた最後の一通に返す。もう返してあれば、次に言うことを順に出す
 * （代理に任せたときと同じ文面——**代理はいつも同じ言葉を持っている**）。
 */
export function draftFor(thread: Thread, bubbles: readonly Bubble[], tone: Tone | null): string | null {
  if (thread.decision !== 'inherit' || !thread.inheritedAt || !thread.seed) return null;
  const since = thread.inheritedAt;
  const after = bubbles.filter((b) => b.at >= since && !b.system);
  const lastLeft = [...after].reverse().find((b) => b.side === 'left');
  const joke = thread.seed.joke.phrase;

  if (!lastLeft) return shapeTo(OPENING, tone);

  const replied = after.some((b) => b.side === 'right' && b.at > lastLeft.at);
  if (replied) {
    const used = thread.sent.length;
    const line = AGENT_REPLIES[used % AGENT_REPLIES.length] ?? AGENT_REPLIES[0] ?? '';
    return shapeTo(splitSentences(line), tone);
  }

  const position = followUpPosition(lastLeft.id, thread.id);
  return shapeTo(replyTo(position, joke), tone);
}

/** 相手から届いた一通の id（f-<thread>-<番号>）から、何番目かを読む。 */
function followUpPosition(id: string, threadId: string): number {
  const match = id.match(new RegExp(`^f-${escape(threadId)}-(\\d+)$`));
  return match ? Number(match[1]) : -1;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 「。」で区切って文にする。末尾の「。」は残す。 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。．])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
