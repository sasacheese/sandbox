/**
 * 踏み外し。
 *
 * 引き継いだトークで自分が打った文を、**引継書に書いてあった作法**と照らす。
 * 呼び方、句点の癖、返信の速さ、一通の長さ、触れてはいけないこと——どれも
 * 引継書がすでに持っている材料で、新しく推測するものは一つも無い。
 *
 * 出し方は淡々と。左に何が違うか、右に代理はどうだったか。叱っているのでは
 * なく、照らしただけ。**踏み外した数だけ、近さの下がり方が大きくなる。**
 */

import { minutesLabel, type Tone } from './transcript.ts';
import type { Slip } from './types.ts';

export type Manner = {
  /** 代理が相手を呼んでいた形。「小松さん」。 */
  address: string;
  /** 相手の名前。「小松 遼」。 */
  name: string;
  /** 相手があなたを呼ぶ形。「たくん」。これで相手を呼ぶと、呼び方が入れ替わっている。 */
  calls: string;
  /** 触れてはいけないこと（引継書の一文）。 */
  avoid: string;
  /** 過去ログから数えた、あなたの書き方。代理はこれに寄せていた。 */
  tone: Tone | null;
};

const HONORIFIC = /(さん|くん|ちゃん|君|様|さま)/g;

/**
 * 呼び方。
 *
 * 敬称の直前を見る。相手の名前の一部（姓・名）なら呼び方が違う。相手が
 * あなたを呼ぶ形と同じなら、呼び方が入れ替わっている。第三者の「◯◯さん」は
 * 相手の名前と重ならないので、拾わない。
 */
export function addressSlip(text: string, manner: Manner): Slip | null {
  const parts = [manner.name, manner.name.replace(/\s+/g, ''), ...manner.name.split(/\s+/)].filter((p) => p.length >= 1);
  for (const match of text.matchAll(HONORIFIC)) {
    const honorific = match[0];
    const index = match.index ?? 0;
    const run = text.slice(Math.max(0, index - 6), index);
    const spoken = run + honorific;
    if (spoken.endsWith(manner.address)) continue;
    const named = parts.filter((p) => run.endsWith(p)).sort((a, b) => b.length - a.length)[0];
    if (named) return { label: '呼び方が違います', detail: `${named}${honorific} → ${manner.address}` };
    if (manner.calls && spoken.endsWith(manner.calls)) return { label: '呼び方が違います', detail: `${manner.calls} → ${manner.address}` };
  }
  return null;
}

/** 触れてはいけないことから、照らす語を取り出す。「実家の話。…」→「実家」。 */
export function avoidKeyword(avoid: string): { keyword: string; topic: string } | null {
  const quoted = avoid.match(/「(.+?)」/);
  const head = (avoid.split(/[。．]/)[0] ?? '').trim();
  if (quoted?.[1]) return { keyword: quoted[1], topic: head || `「${quoted[1]}」` };
  const keyword = head.replace(/(の話題|の話|のこと|について|という言い方|の件)$/, '').trim();
  return keyword.length >= 2 ? { keyword, topic: head } : null;
}

export function slipsOf(text: string, manner: Manner, waitedMinutes: number | null): Slip[] {
  const out: Slip[] = [];
  const body = text.trim();
  const tone = manner.tone;

  const address = addressSlip(body, manner);
  if (address) out.push(address);

  if (tone) {
    const hasPeriod = /[。．]/.test(body);
    if (!tone.period && hasPeriod) out.push({ label: '句点を打っています', detail: '代理は打ちませんでした' });
    if (tone.period && !/[。．]$/.test(body) && [...body].length >= 6) out.push({ label: '句点がありません', detail: '代理は打っていました' });

    const length = [...body.replace(/\s/g, '')].length;
    if (length > Math.max(tone.avgLength * 2, tone.avgLength + 20)) {
      out.push({ label: `一通 ${length} 文字`, detail: `代理は平均 ${tone.avgLength} 文字でした` });
    }

    if (waitedMinutes !== null && tone.replyMinutes !== null && waitedMinutes > Math.max(tone.replyMinutes * 2, tone.replyMinutes + 15)) {
      out.push({ label: `返信 ${minutesLabel(waitedMinutes)}`, detail: `代理は ${minutesLabel(tone.replyMinutes)}でした` });
    }
  }

  const avoid = avoidKeyword(manner.avoid);
  if (avoid && body.includes(avoid.keyword)) out.push({ label: '触れてはいけないことに触れています', detail: avoid.topic });

  return out;
}
