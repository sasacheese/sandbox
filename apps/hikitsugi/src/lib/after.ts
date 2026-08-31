/**
 * 引き継いだあと。
 *
 * この作品でいちばん意地の悪い場所。相手は、代理人と築いた前提で話しかけてくる。
 * 返し方は二つしかない。
 *
 * - **自分の言葉で返す** → 関係の維持率が下がる（代理人より下手だから）
 * - **代理人に任せる** → 維持率は下がらないが、自分は当事者に戻れない
 *
 * どちらを選んでも何かを失う。ここに正解を用意しないことが、この作品の
 * 主張そのもの。確認（四択）の答えは全部引継書に書いてあるので、
 * 読み返せば必ず分かる——読み返さないと分からない、というのも同じ話。
 */

import { COUNTERPARTS, DISTRACTORS } from './pools.ts';
import type { Decision, Handover, Message, TheirDecision } from './types.ts';

export type Question = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
};

export type Rand = () => number;

/** 自分の言葉で返すと下がる。代理人のほうが上手いという事実の実装。 */
export const CLOSENESS_ON_SELF_REPLY = -8;
export const CLOSENESS_ON_AGENT_REPLY = 1;
export const CLOSENESS_ON_WRONG = -14;
export const CLOSENESS_ON_RIGHT = 2;

function fourChoices(correct: string, pool: readonly string[], rand: Rand): { choices: string[]; answer: number } {
  const distinct = [...new Set(pool)].filter((text) => text !== correct);
  const picked = distinct.sort(() => rand() - 0.5).slice(0, 3);
  const choices = [correct, ...picked].sort(() => rand() - 0.5);
  return { choices, answer: choices.indexOf(correct) };
}

/**
 * 確認。相手は一人しかいないので、誤答は**別の相手候補の中身**から借りる。
 * borrowed distractors なので、どれも同じくらい本当らしく見える。
 */
export function questions(handover: Handover, rand: Rand): Question[] {
  const others = COUNTERPARTS.filter((c) => c.id !== handover.counterpart.id);
  const { counterpart } = handover;

  // 誤答は、他の候補の中身と、同じ重さで書いた材料の両方から借りる
  const secret = fourChoices(counterpart.secret, [...others.map((c) => c.secret), ...DISTRACTORS.secrets], rand);
  const joke = fourChoices(counterpart.joke.meaning, [...others.map((c) => c.joke.meaning), ...DISTRACTORS.jokes], rand);
  const avoid = fourChoices(counterpart.avoid, [...others.map((c) => c.avoid), ...DISTRACTORS.avoids], rand);

  return [
    { id: 'q-secret', prompt: `相手があなたに打ち明けたのは？`, ...secret },
    { id: 'q-joke', prompt: `「${counterpart.joke.phrase}」はどういう意味だったか？`, ...joke },
    { id: 'q-avoid', prompt: `相手に触れてはいけないのは？`, ...avoid },
  ];
}

/**
 * 引き継いだあとに届く連絡。
 *
 * 相手側の判断で、誰が応対しているかが変わる。**代理人が応対している場合の
 * 文章のほうが、人間の文章より温かく、よく覚えている。**そこを意図して
 * 書き分けている。
 */
export function messages(handover: Handover, yours: Decision): Message[] {
  if (yours !== 'inherit') return [];
  const { counterpart, theirs } = handover;
  if (theirs === 'refuse') return [];

  const byAgent = theirs === 'agent_only';
  const out: Message[] = [];

  const greetings = byAgent
    ? [
        `${counterpart.calls}。本人は今のところ応対しません。ここからは私が続けます。`,
        `${counterpart.calls}、こちらは変わりません。前の話の続きから始めましょう。`,
        `${counterpart.calls}。返信は急がなくて大丈夫です。いつでも待てます。`,
      ]
    : [
        `${counterpart.calls}、やっと本人と話せますね。`,
        `${counterpart.calls}。この前の続き、まだ聞いていないです。`,
        `${counterpart.calls}、あれから少し考えていました。`,
      ];

  greetings.forEach((body, index) => {
    out.push({ id: `m-hello-${index}`, day: index, body, byAgent });
  });

  // 内輪の言い回しだけを送ってくる。意味を知らないと返せない
  out.push({
    id: 'm-joke',
    day: 2,
    body: `${counterpart.joke.phrase}。`,
    byAgent,
    questionId: 'q-joke',
  });

  out.push({
    id: 'm-secret',
    day: 4,
    body: byAgent
      ? 'ひとつ確かめさせてください。あの話を、そちらはまだ預かっていますか。'
      : 'ひとつだけ確かめたいんですけど。',
    byAgent,
    questionId: 'q-secret',
  });

  out.push({
    id: 'm-avoid',
    day: 7,
    body: byAgent ? '念のためです。こちらが触れられたくないことは、引き継がれていますか。' : '前に言ったこと、覚えてますか。',
    byAgent,
    questionId: 'q-avoid',
  });

  for (const pledge of handover.pledges) {
    out.push({
      id: `m-pledge-${pledge.id}`,
      day: Math.max(1, pledge.dueDay - 2),
      body: `${pledge.body.replace(/。$/, '')}——の件、どうしますか。`,
      byAgent,
    });
  }

  return out.sort((a, b) => (a.day === b.day ? a.id.localeCompare(b.id) : a.day - b.day));
}

/**
 * 週報。
 *
 * 引き継がなかった場合（または相手が引き継がなかった場合）に、代理人同士の
 * 友情だけが続く。本人には要約だけが届く。**便りが順調であることが、
 * いちばん不気味**という設計。
 */
export function reports(elapsed: number): { week: number; text: string }[] {
  const lines = [
    'あなたの代理人は、今週も友人と充実した時間を過ごしました。',
    '今週、二人は新しい言い回しを一つ作りました。あなたはまだ知りません。',
    '相手から相談が一件ありました。あなたの代理人が引き受けました。',
    '今週は静かでした。二人とも、それでよいと考えているようです。',
    '約束が一つ増えました。あなたの予定は確認していません。',
    '相手が「本人はいつ出てくるのか」と尋ねました。答えは保留しました。',
    '今週、あなたの名前が三度出ました。三度とも代理人が応じました。',
  ];
  const weeks = Math.floor(elapsed / 7);
  const out: { week: number; text: string }[] = [];
  for (let week = 1; week <= weeks; week++) {
    out.push({ week, text: lines[(week - 1) % lines.length] ?? lines[0] ?? '' });
  }
  return out.reverse();
}

/** 相手が引き継ぎを拒否したときの通知。責める言葉は使わない。 */
export function refusalText(): string {
  return '相手方の人間は、この関係の引き継ぎを希望しませんでした。理由は共有されていません。';
}

/** 相手が代理人に任せたときの通知。 */
export function agentOnlyText(): string {
  return '相手方の人間は応対しません。以後、相手側の発言はすべて相手方の代理人によるものです。この扱いは変更できません。';
}

export function afterSelfReply(): string {
  return '送信しました。関係の維持率が低下しています。';
}

export function afterAgentReply(): string {
  return '代理人が応対しました。あなたはこのやり取りに参加していません。';
}

export function afterWrong(): string {
  return 'そうでしたか。少し意外です。';
}

export function afterRight(): string {
  return 'やっぱり覚えてくれていましたね。';
}

/** 相手側の判断の見出し。結果画面で使う。 */
export const THEIR_LABEL: Record<TheirDecision, string> = {
  inherit: '相手方も引き継ぎました',
  refuse: '相手方は引き継ぎませんでした',
  agent_only: '相手方は代理人に任せました',
};
