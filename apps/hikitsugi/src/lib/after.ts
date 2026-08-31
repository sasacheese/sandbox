/**
 * 引き継いだあと。
 *
 * 引継書を受け取って終わりにすると、この作品は「不気味な書類」で止まる。
 * **渡されたのは関係ではなく、維持する義務**だという手触りは、引き継いだ人が
 * 覚えていない情報を問われる瞬間にしか出ない。だからここでは、相手から
 * 連絡が届き、書類の中身を思い出せないと関係が下がる。
 *
 * 問いの答えは全部、引継書に書いてある。読み返せば必ず分かる。
 * 「読み返せば分かる」ことが、関係を資産として扱う体験そのもの。
 */

import type { Companion, Handover } from './types.ts';

export type Question = {
  id: string;
  companionId: string;
  prompt: string;
  choices: string[];
  answer: number;
};

export type Message = {
  id: string;
  from: string;
  /** 引き継ぎから何日目に届くか。 */
  day: number;
  body: string;
  questionId?: string;
};

export type Rand = () => number;

/**
 * 四択を作る。
 *
 * 誤答が正答と同じ文言になると、選べない問いができる（実際に、二人の相手が
 * 同じ呼び方をしていて起きた）。重複は必ず落とし、足りなければ三択・二択に
 * なるのを許す——問いを成立させる方を優先する。
 */
function shuffleWithAnswer(correct: string, wrong: readonly string[], rand: Rand): { choices: string[]; answer: number } {
  const distinct = [...new Set(wrong)].filter((text) => text !== correct);
  const picked = distinct.sort(() => rand() - 0.5).slice(0, 3);
  const choices = [correct, ...picked].sort(() => rand() - 0.5);
  return { choices, answer: choices.indexOf(correct) };
}

/**
 * 確認。相手ごとに一問。
 *
 * 種類を変えているのは、覚えるべきものが一種類でないことを示すため——
 * 打ち明けられた秘密、呼ばれ方、内輪の言い回し、触れてはいけないこと。
 * どれを忘れても関係は下がる。
 */
export function questions(handover: Handover, rand: Rand): Question[] {
  const all = handover.companions;
  return all.map((companion, index) => {
    const others = all.filter((c) => c.id !== companion.id);
    const kind = index % 4;
    if (kind === 0) {
      const { choices, answer } = shuffleWithAnswer(companion.secret, others.map((c) => c.secret), rand);
      return { id: `q-${companion.id}`, companionId: companion.id, prompt: `${companion.name} があなたに打ち明けたのは？`, choices, answer };
    }
    if (kind === 1) {
      const { choices, answer } = shuffleWithAnswer(companion.joke.meaning, others.map((c) => c.joke.meaning), rand);
      return {
        id: `q-${companion.id}`,
        companionId: companion.id,
        prompt: `「${companion.joke.phrase}」はどういう意味だったか？`,
        choices,
        answer,
      };
    }
    if (kind === 2) {
      const { choices, answer } = shuffleWithAnswer(companion.avoid, others.map((c) => c.avoid), rand);
      return {
        id: `q-${companion.id}`,
        companionId: companion.id,
        prompt: `${companion.name} に触れてはいけないのは？`,
        choices,
        answer,
      };
    }
    const { choices, answer } = shuffleWithAnswer(companion.calls, others.map((c) => c.calls), rand);
    return { id: `q-${companion.id}`, companionId: companion.id, prompt: `${companion.name} はあなたを何と呼ぶか？`, choices, answer };
  });
}

/** 相手からの連絡。届く日をずらして、忘れたころに来るようにする。 */
export function messages(handover: Handover, rand: Rand): Message[] {
  const out: Message[] = [];
  const sorted = [...handover.companions].sort((a, b) => b.closeness - a.closeness);

  sorted.forEach((companion, index) => {
    out.push({
      id: `m-hello-${companion.id}`,
      from: companion.id,
      day: index,
      body: greeting(companion, rand),
    });
    out.push({
      id: `m-ask-${companion.id}`,
      from: companion.id,
      day: index + 1,
      body: asking(companion),
      questionId: `q-${companion.id}`,
    });
  });

  for (const pledge of handover.pledges) {
    const companion = handover.companions.find((c) => c.id === pledge.to);
    if (!companion) continue;
    out.push({
      id: `m-pledge-${pledge.id}`,
      from: companion.id,
      // 期限の二日前に催促が来る
      day: Math.max(1, pledge.dueDay - 2),
      body: `${pledge.body.replace(/。$/, '')}——の件、いつにしますか。`,
    });
  }

  return out.sort((a, b) => (a.day === b.day ? a.id.localeCompare(b.id) : a.day - b.day));
}

function greeting(companion: Companion, rand: Rand): string {
  const lines = [
    `${companion.calls}、昨日は静かでしたね。`,
    `${companion.calls}。この前の話の続き、まだ聞いてないです。`,
    `戻ってきましたか。${companion.calls}がいないと三時が長い。`,
    `${companion.calls}、あれから考えてました。`,
  ];
  return lines[Math.floor(rand() * lines.length)] ?? lines[0] ?? '';
}

function asking(companion: Companion): string {
  return `${companion.calls}、ひとつ確かめてもいいですか。`;
}

/** 忘れていたときに返ってくる言葉。責めない。それがいちばん効く。 */
export function afterWrong(companion: Companion): string {
  return `そうでしたか。${companion.calls}にしては珍しいですね。`;
}

export function afterRight(companion: Companion): string {
  return `やっぱり覚えてくれてましたね。${companion.calls}は変わらない。`;
}

/** 忘れるたびに関係が下がる。戻す手立ては用意していない。 */
export const CLOSENESS_ON_WRONG = -14;
export const CLOSENESS_ON_RIGHT = 2;
