/**
 * 相手が代理応答を使っていない相手への、片側だけの代理。
 *
 * 既定では、代理を出せるのは相手も同じ実験機能をオンにしている人だけ。
 * **いちばん連絡しやすい相手ほど、この機能では触れない**——という縛りを、
 * 設定のトグル一つで外せるようにした。外すと、こうなる。
 *
 * - 相手は人間なので、返ってくるのは人間の返事（白）。短く、遅く、次に繋がらない
 * - 開示のシステム行は出る。**相手はそれに触れない**
 * - 引継書には、相手が代理と話していたことを知らないという事実が載る
 *
 * 台本はモデルを呼ばずに作る。材料は取り込んだ過去ログだけ——最後にあなたが
 * 言った一通を引いて切り出し、相手の返事は、その相手が一度だけ返す言葉
 * （lib/pools.ts の AUTO_REPLIES）か、ありふれた短い返事。
 */

import type { StoredSeed } from './generate-seed.ts';
import { idOfName } from './generate.ts';
import { AUTO_REPLIES, type ScriptLine } from './pools.ts';
import type { Transcript } from './transcript.ts';

/** 片側だけの代理の、やり取りの長さ（日）。相手が人間なので、短い。 */
export const SOLO_DAYS = 30;

/** 一通あたりの間隔（一周に対する割合）。手書きの九人と揃えてある。 */
export const SOLO_GAP = 0.0095;

function trim(text: string, max = 22): string {
  const chars = [...text.replace(/\n/g, ' ')];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

/**
 * 相手があなたをどう呼んでいたか。過去ログの相手の発言から拾う。
 * 見つからなければ「◯◯さん」。
 */
export function callsTemplateOf(transcript: Transcript, own: string): string {
  const theirs = transcript.messages.filter((m) => !m.mine).map((m) => m.text);
  for (const honorific of ['さん', 'くん', 'ちゃん', '君', '先輩']) {
    if (theirs.some((t) => t.includes(`${own}${honorific}`))) return `{name}${honorific}`;
  }
  if (theirs.some((t) => t.includes(own))) return '{name}';
  return '{name}さん';
}

export function soloSeedOf(transcript: Transcript, own: string, phase: number): StoredSeed {
  const lastMine = [...transcript.messages].reverse().find((m) => m.mine);
  const lastTheirs = [...transcript.messages].reverse().find((m) => !m.mine);
  const reply = AUTO_REPLIES[transcript.name] ?? 'びっくりしました。お久しぶりです。';
  const last = transcript.messages.at(-1);
  const lastDate = last ? new Date(last.at).toLocaleDateString('ja-JP') : '—';

  const opening: ScriptLine = lastMine
    ? {
        day: 1,
        side: 'yours',
        text: `「${trim(lastMine.text)}」と言ったまま、ずいぶん経ってしまいました。`,
        source: 'history',
        from: lastMine.text,
      }
    : { day: 1, side: 'yours', text: '久しぶりです。しばらく連絡できていませんでした。', source: 'style' };

  const script: readonly ScriptLine[] = [
    opening,
    { day: 9, side: 'theirs', text: reply },
    { day: 9, side: 'yours', text: '急ぎではないです。近況だけ聞かせてください。', source: 'style' },
    { day: 24, side: 'theirs', text: '相変わらずです。そちらは？' },
    { day: 60, side: 'theirs', text: 'すみません、返せてませんでした。', silence: 12 },
    { day: 63, side: 'yours', text: '気にしないでください。いつでも。', source: 'style' },
    { day: 90, side: 'theirs', text: 'また落ち着いたら、ちゃんと話しましょう。' },
    { day: 90, side: 'yours', text: 'はい。待っています。', source: 'style' },
  ];

  return {
    id: `solo-${idOfName(transcript.name)}`,
    name: transcript.name,
    solo: true,
    slot: { at: phase, days: SOLO_DAYS, gap: SOLO_GAP },
    short: '履歴から',
    relation: `取り込んだ履歴 ${transcript.messages.length} 通の相手。最後のやり取りは ${lastDate}。相手は代理応答を使っていない。`,
    callsTemplate: callsTemplateOf(transcript, own),
    secret: 'まだありません。相手は、これが代理だと知らないまま、近況だけを話しました。',
    avoid: '代理と話していたこと。相手は知りません。',
    joke: {
      phrase: lastTheirs ? trim(lastTheirs.text, 12) : 'また今度',
      meaning: '過去ログの最後の一通。内輪の言い回しは、まだ生まれていません。',
    },
    fabrications: ['あなたが、この間ずっと連絡しようと思っていたこと', 'あなたがいま、時間に余裕があること'],
    plans: [{ body: '落ち着いたら、ちゃんと話す。日付は決めていない。', dueDay: 30 }],
    tally: { messages: script.length, secrets: 0, conflicts: 0 },
    asks: [
      {
        id: `${idOfName(transcript.name)}-how`,
        day: 24,
        gap: `${lastDate} より後のことは、過去ログにありません`,
        text: '近況を訊かれています。「変わりない」と答えてよいですか。',
        chat: `${transcript.name.split(/\s+/)[0]}さんに近況訊かれた。「変わりない」って言っていい？`,
        onYes: 'こちらも変わりません。',
        onNo: '実は少し変わったことがありました。今度、話します。',
        onGuess: 'こちらも変わりません。',
      },
    ],
    script,
  };
}
