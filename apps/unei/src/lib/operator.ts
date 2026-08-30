/**
 * 運営。このコミュニティで唯一、能動的に動く主体。
 *
 * 文体の規則を先に決めてある。ここが崩れると世界が一瞬で嘘になる。
 *
 * 1. **説明しない。** 理由・目的・背景を述べない。問われても答えない。
 * 2. **呼びかけない。** 「みなさん」「諸君」を使わない。宛先が無い文で書く。
 * 3. **常体、短文、三行以内。** 敬語を使うと事務局になり、饒舌にすると幹事になる。
 * 4. **労わない。** 感謝も励ましもしない。受理と却下だけがある。
 * 5. **一人称を持たない。** 「私」も「運営」も名乗らない。名乗る必要が無いから。
 *
 * 生成の実体は 2 つある。ここに書いてある雛形から選ぶ方式（既定）と、
 * lib/claude.ts の本物のモデル。どちらでも上の規則は変わらない。雛形の方を
 * 残しているのは、鍵を持たない人が触れないと作品が成立しないから。
 */

import {
  DECREE_INTERVAL_HOURS,
  DIRECTIVE_INTERVAL_HOURS,
  REPORT_GRACE_HOURS,
  STOP_DELAY_HOURS,
  type Directive,
  type Realm,
} from './types.ts';

export type Rng = () => number;

function pick<T>(list: readonly T[], rng: Rng): T {
  const item = list[Math.floor(rng() * list.length)];
  if (item === undefined) throw new Error('空の候補から選ぼうとした');
  return item;
}

/**
 * 意味のない条件。
 *
 * 儀礼を儀礼にしているのは、目的の説明できなさ。役に立つ条件（「連絡先を
 * 交換すること」など）を一つでも混ぜると、途端に交流イベントの体裁になる。
 */
export const CONDITIONS: readonly string[] = [
  '全員が同じ方向を向いて三分間立つこと',
  '誰も声を出さずに五分過ごすこと',
  '各自、持ち物を一つ地面に置くこと',
  '全員で同時に空を見上げ、写真を一枚撮ること',
  '円になり、外側を向くこと',
  '集合場所の周囲を、時計回りに一周すること',
  '各自、赤いものを一つ持参すること',
  '到着した順に番号を割り当て、名前では呼ばないこと',
  '全員が同じ飲み物を買うこと',
  '三分間、誰も端末を見ないこと',
  '一人が数を数え、他の全員は黙って聞くこと',
  '最後に到着した者が、最初に立ち去ること',
  '全員が靴紐、またはそれに相当するものを結び直すこと',
  '誰か一人が「はじめます」と言うまで、誰も座らないこと',
  '解散のとき、別れの挨拶をしないこと',
  '全員が、その場に無いものの名前を一つずつ言うこと',
  '影を踏まないように立つこと',
  '一分間、全員が目を閉じること',
  '各自、今日まだ誰にも言っていないことを一つ言うこと',
  '全員が同時に一歩下がること',
  '誰も先頭に立たないように歩くこと',
  '持ち寄ったものを交換し、持ち帰ること',
  '全員が、いま何時か声に出さずに書き、見せ合うこと',
  '三人以上が同じ言葉を口にするまで待つこと',
  '一人だけ、最後まで座らないこと',
  '各自、来た道と違う道で帰ること',
  '全員が一度だけ手を叩くこと。合図は出さない',
  '集合場所にあるものを数え、数を一致させること',
  '誰も写真に写らないように、その場所の写真を撮ること',
  '五分間、誰も名前を呼ばれないようにすること',
];

/** 集合までの猶予（分）。半端な数字にしてあるのは、指定された感を出すため。 */
const OFFSETS: readonly number[] = [37, 43, 47, 61, 73, 89, 113];

export const REALM_NAMES: readonly string[] = [
  '第七区',
  '無名の会',
  '夜間営業',
  '三十七番',
  '待機所',
  '東の集まり',
  '丙',
  '未定',
  '無題のコミュニティ',
  '第二次',
];

export const LAWS: readonly string[] = [
  '集合時刻に遅れた者は、次の指令で最初に到着すること',
  '指令の理由を問わないこと',
  '写真に人の顔を写さないこと',
  '報告は一度きりとし、訂正しないこと',
  '欠席した者を責めないこと',
  '指令の内容を、参加しない者に説明しないこと',
  '沈黙を命じられた者に話しかけないこと',
  '祭りの最中に、次の祭りの話をしないこと',
  '運営を人と呼ばないこと',
  '同じ場所を三度続けて使わないこと',
];

export const ACCENTS: readonly string[] = ['#c8452e', '#c8992e', '#4f8fc0', '#7a6fc8', '#4fa07a', '#b8546f'];

export const UTTERANCES: readonly string[] = [
  '記録は残っている。',
  '静かすぎる。',
  '前回の報告を読み返した。',
  '数は足りていた。',
  '待っている。',
  'まだ何も決めていない。',
  '同じ場所が続いている。',
  '応答が遅い。',
  '欠けている者がいる。',
  '次はもっと短くする。',
];

/** 参加者。実在しない。人がいる感じを出すためだけに置いている。 */
export const OTHERS: readonly string[] = ['みなと', 'K.', 'いとう', 'なお', '橘', '守屋', 'hina', 'まる', '境'];

export const ACCEPTED_TEXTS: readonly string[] = [
  '受理した。',
  '記録した。次を待て。',
  '条件は満たされている。',
  '見た。',
  '受理する。',
];

/** 写真が付いているときだけ選べる言葉。無いのに「写真は残す」と言うと嘘になる。 */
export const ACCEPTED_WITH_PHOTO: readonly string[] = ['受理する。写真は残す。', '写真を見た。受理する。'];

export const REJECTED_TEXTS: readonly string[] = [
  '数は足りている。だが熱が足りない。再実行せよ。',
  '受理しない。理由は述べない。',
  '条件が守られていない。',
  '早すぎた。',
  '報告が短い。もう一度。',
];

export type IssuedDirective = {
  gatherOffsetMinutes: number;
  place: string;
  minPeople: number;
  condition: string;
};

export function makeDirective(places: readonly string[], rng: Rng = Math.random): IssuedDirective {
  return {
    gatherOffsetMinutes: pick(OFFSETS, rng),
    place: places.length > 0 ? pick(places, rng) : '前回と同じ場所',
    minPeople: 2 + Math.floor(rng() * 3),
    condition: pick(CONDITIONS, rng),
  };
}

/**
 * 裁定。
 *
 * 条件を満たしていれば受理、が基本。ただし一定の割合で、満たしていても却下し、
 * 満たしていなくても受理する。**測れない**ことが運営を運営にしている。
 * ここを厳密な判定にすると、ただの出席管理になる。
 */
export function makeVerdict(
  people: number,
  minPeople: number,
  rng: Rng = Math.random,
  hasPhoto = false,
): { accepted: boolean; text: string } {
  const enough = people >= minPeople;
  const roll = rng();
  if (enough && roll < 0.2) return { accepted: false, text: pick(REJECTED_TEXTS, rng) };
  if (!enough && roll > 0.85) return { accepted: true, text: '足りない。だが受理する。' };
  if (!enough) return { accepted: false, text: '数が足りない。' };
  const pool = hasPhoto ? [...ACCEPTED_TEXTS, ...ACCEPTED_WITH_PHOTO] : ACCEPTED_TEXTS;
  return { accepted: true, text: pick(pool, rng) };
}

export type DecreeDraft = { kind: 'rename' | 'law_add' | 'law_remove' | 'silence' | 'accent' | 'utterance'; text: string; value: string };

/** 布告。運営が権限を行使する。行使できる先は Realm の中身そのもの。 */
export function makeDecree(realm: Realm, rng: Rng = Math.random): DecreeDraft {
  const kinds: DecreeDraft['kind'][] = ['rename', 'law_add', 'accent', 'utterance', 'utterance', 'silence'];
  if (realm.laws.length > 2) kinds.push('law_remove');
  const kind = pick(kinds, rng);
  switch (kind) {
    case 'rename': {
      const value = pick(
        REALM_NAMES.filter((n) => n !== realm.name),
        rng,
      );
      return { kind, value, text: `このコミュニティの名を「${value}」に改める。` };
    }
    case 'law_add': {
      const remaining = LAWS.filter((l) => !realm.laws.includes(l));
      if (remaining.length === 0) return { kind: 'utterance', value: '', text: pick(UTTERANCES, rng) };
      const value = pick(remaining, rng);
      return { kind, value, text: `掟を一つ加える。${value}。` };
    }
    case 'law_remove': {
      const value = pick(realm.laws, rng);
      return { kind, value, text: `掟を一つ取り消す。「${value}」は、もう無い。` };
    }
    case 'silence': {
      const value = pick(
        OTHERS.filter((n) => !realm.silenced.includes(n)),
        rng,
      );
      return { kind, value, text: `${value} に沈黙を命じる。期間は定めない。` };
    }
    case 'accent': {
      const value = pick(
        ACCENTS.filter((c) => c !== realm.accent),
        rng,
      );
      return { kind, value, text: 'この場所の色を変える。' };
    }
    default:
      return { kind: 'utterance', value: '', text: pick(UTTERANCES, rng) };
  }
}

export type Action =
  | { kind: 'issue' }
  | { kind: 'miss'; id: Directive['id'] }
  | { kind: 'decree' }
  | { kind: 'stop' };

/**
 * 次に運営が起こすこと。
 *
 * アプリを開いた時と、開いているあいだ一定間隔で呼ぶ。閉じているあいだの
 * 経過も、時刻の差から復元されるので取りこぼさない（運営は見ていないときも
 * 動いている、という前提を実装で守る）。
 */
export function nextActions(
  state: { realm: Realm; directives: readonly Directive[]; lastDecreeAt: string | null },
  now: Date,
  rate = 1,
): Action[] {
  const actions: Action[] = [];
  if (state.realm.stopped) return actions;

  if (state.realm.stopRequestedAt && hoursSince(state.realm.stopRequestedAt, now) * rate >= STOP_DELAY_HOURS) {
    return [{ kind: 'stop' }];
  }

  const open = state.directives.filter((d) => d.status === 'open');
  for (const directive of open) {
    if (hoursSince(directive.gatherAt, now) * rate >= REPORT_GRACE_HOURS) actions.push({ kind: 'miss', id: directive.id });
  }

  const stillOpen = open.length > actions.filter((a) => a.kind === 'miss').length;
  const lastIssued = latest(state.directives.map((d) => d.issuedAt));
  if (!stillOpen && (lastIssued === null || hoursSince(lastIssued, now) * rate >= DIRECTIVE_INTERVAL_HOURS)) {
    actions.push({ kind: 'issue' });
  }

  if (state.lastDecreeAt === null || hoursSince(state.lastDecreeAt, now) * rate >= DECREE_INTERVAL_HOURS) {
    actions.push({ kind: 'decree' });
  }

  return actions;
}

function hoursSince(iso: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
}

function latest(times: readonly string[]): string | null {
  return times.length === 0 ? null : [...times].sort().at(-1) ?? null;
}
