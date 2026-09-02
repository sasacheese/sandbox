/**
 * 自分の代理とのトーク。
 *
 * 代理は「**あなたのフリをして連絡する役**」。友達に「あんた連絡するの得意
 * だから、私のフリしてやり取りしといて」と頼んだ、あの関係を再現する。だから
 * ここでの口調は敬語ではなく、頼まれた友達のもの——軽く、率直で、分からない
 * ことは**その都度こちらへ訊いてくる**。
 *
 * 訊いてくるのは、過去ログに無いことに触れたとき。「菅野さんから離婚の話きた。
 * 私も似たことあったって言っていい？」——答えないと、勝手に言う。
 *
 * 指示の読み取りは規則で行う。名前と動詞の組み合わせが分かれば止める・再開する。
 * 分からないものは**覚えておく**と引き取り、引継書の注意事項に載せる。
 * 何を理解したかは必ず言い直す——それが唯一の、指示が通ったかの確認になる。
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

/** 姓だけで呼ぶ。「菅野 千夏」→「菅野さん」。一語の名前はそのまま。 */
export function callOf(name: string): string {
  const family = name.split(/\s+/)[0] ?? name;
  return `${family}さん`;
}

/**
 * 代理の返事。
 *
 * 短く、友達の口調で、**何を理解したかを言い直す**。理解が違っていれば、ここで分かる。
 */
export function replyFor(rule: Rule, live: readonly string[]): string {
  switch (rule.kind) {
    case 'mute':
      return `オッケー、${callOf(rule.target ?? '')}にはもう送らないでおく。向こうには言わないよ。`;
    case 'unmute':
      return `${callOf(rule.target ?? '')}とまた話すね。止めてたあいだのことは触れないから。`;
    case 'note':
      return rule.target
        ? `${callOf(rule.target)}のこと、了解。「${short(rule.text)}」——覚えとく。引継書にも書いとくね。`
        : live.length > 0
          ? `了解。「${short(rule.text)}」——いま話してる ${live.length} 人には、そうする。`
          : `了解。「${short(rule.text)}」——これから話す人には、そうする。`;
  }
}

function short(text: string): string {
  const chars = [...text.trim()];
  return chars.length > 40 ? `${chars.slice(0, 40).join('')}…` : chars.join('');
}

/** 代理応答をオンにした直後の、最初の一通。 */
export function openingOf(own: string, count: number): string {
  return `${own}、代理だよ。トーク履歴 ${count} 件、読ませてもらった。しばらく連絡してない人たちに、私が${own}のフリして声かけてみるね。言っちゃダメなことや、話したくない人がいたらここに書いて。分からないことがあったら、その都度こっちから聞くから。`;
}

/**
 * 代理が、自分から言ってくること。
 *
 * 訊く（確認）以外にも、始めた・言ってしまった・一区切りついた、を報告する。
 * **頼まれた友達なら、それくらいは言ってくる。**
 */
export const SAYS = {
  started: (name: string) => `${callOf(name)}に声かけてみた。返ってきたよ。`,
  guessed: (name: string, said: string) => `${callOf(name)}の件、返事なかったから「${said}」って言っといた。違ってたら言って。`,
  done: (name: string) => `${callOf(name)}とのやり取り、一区切りついた。引継書まとめといたから、代理タブから見て。`,
  /** 引き継いで数通やり取りしたあとの問い。 */
  feel: (name: string) => `${callOf(name)}と、引き継げた感じ、する？`,
  /** どれを選んでも、これしか言わない。**作品は判定を持たない。** */
  feelReply: () => 'そう。',
  /** 差し戻されたとき。戻されたことに触れる。近さが戻らないことも言う。 */
  returned: (name: string) => `${callOf(name)}の件、また私が引き受けるね。自分で書いてたぶんはそのまま残しとく。近さは戻らないけど、続きはやっとく。`,
};

/** 「引き継げた感じ、する？」の選択肢。 */
export const FEEL_LABEL: Record<'yes' | 'notyet' | 'unsure', string> = {
  yes: 'した',
  notyet: 'まだ',
  unsure: '分からない',
};

/** 引き継いだあと、何通やり取りしたら訊くか。 */
export const FEEL_AFTER_SENT = 3;
