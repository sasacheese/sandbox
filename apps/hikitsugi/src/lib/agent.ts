/**
 * 自分の代理とのトーク。
 *
 * ここだけは、代理が**あなたに向けて**話す。指示を受け取り、誰と話さないか、
 * 何を言わないかを決めておく場所。LINE で言えば、公式アカウントとのトークが
 * いちばん近い——返事は来るが、人ではない。
 *
 * 指示の読み取りは規則で行う。名前と動詞の組み合わせが分かれば止める・再開する。
 * 分からないものは**申し送り**として引き取り、引継書の注意事項に載せる。
 * 代理は「分かりました」を言うが、**何が分かったかは必ず言い直す**——それが
 * 唯一の、指示が通ったかどうかの確認になる。
 */

import type { IsoTime } from './types.ts';

export type RuleKind = 'mute' | 'unmute' | 'note';

export type Rule = {
  id: string;
  at: IsoTime;
  /** 本人が打った文そのまま。 */
  text: string;
  kind: RuleKind;
  /** 止める・再開する相手。無ければ全体への申し送り。 */
  target?: string;
};

const MUTE = /(返さ|返事|返信|話さ|話し|連絡|止め|やめ|中止|保留|待っ|ストップ|触ら|送ら)/;
const UNMUTE = /(再開|戻し|続けて|続けろ|話していい|返していい|解除|もういい|始めて|動かして)/;
const NEGATIVE = /(ない|ないで|んで|するな|しないで|やめ|止め|ストップ|中止|保留|待っ)/;

/**
 * 名前を文の中から見つける。
 *
 * 姓だけ・名だけ・敬称つき、どれでも拾う。「菅野さんには」も「千夏には」も
 * 同じ相手。
 */
export function findName(text: string, names: readonly string[]): string | undefined {
  const hits = names
    .map((name) => {
      const parts = name.split(/\s+/);
      const forms = [name, name.replace(/\s+/g, ''), ...parts].filter((f) => f.length >= 2);
      const hit = forms.find((f) => text.includes(f));
      return hit ? { name, length: hit.length } : null;
    })
    .filter((h): h is { name: string; length: number } => h !== null)
    .sort((a, b) => b.length - a.length);
  return hits[0]?.name;
}

/** 文を読んで、何の指示か決める。 */
export function interpret(text: string, names: readonly string[]): { kind: RuleKind; target?: string } {
  const target = findName(text, names);
  if (target && UNMUTE.test(text)) return { kind: 'unmute', target };
  if (target && MUTE.test(text) && NEGATIVE.test(text)) return { kind: 'mute', target };
  if (target && MUTE.test(text)) return { kind: 'mute', target };
  return target ? { kind: 'note', target } : { kind: 'note' };
}

/**
 * 代理の返事。
 *
 * 短く、敬語で、**何を理解したかを言い直す**。理解が違っていれば、ここで分かる。
 */
export function replyFor(rule: Rule, live: readonly string[]): string {
  switch (rule.kind) {
    case 'mute':
      return `${rule.target} さんとのやり取りを止めます。再開するまで、こちらからは送りません。相手には知らせません。`;
    case 'unmute':
      return `${rule.target} さんとのやり取りを再開します。止めていたあいだのことは、こちらからは触れません。`;
    case 'note':
      return rule.target
        ? `${rule.target} さんについて、承りました。「${short(rule.text)}」——引継書の注意事項に載せます。`
        : live.length > 0
          ? `承りました。「${short(rule.text)}」——いま話している ${live.length} 人との、これからのやり取りに反映します。`
          : `承りました。「${short(rule.text)}」——これからのやり取りに反映します。`;
  }
}

function short(text: string): string {
  const chars = [...text.trim()];
  return chars.length > 40 ? `${chars.slice(0, 40).join('')}…` : chars.join('');
}

/** 代理応答をオンにした直後の、最初の一通。 */
export function openingOf(own: string, count: number): string {
  return `${own} さん。代理です。取り込まれた ${count} 件の過去ログを読みました。相手も代理応答を使っている方から、順に声をかけていきます。話したくない相手、触れたくない話題があれば、ここに書いてください。`;
}
