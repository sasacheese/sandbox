/**
 * 引継書の材料。この作品の質は、ほぼここの文章で決まる。
 *
 * 守っている規則が四つ。
 *
 * 1. **代理人同士のやり取りを主役にする。** 相性スコアを前に出すと、
 *    ただのマッチングサービスに見える。読ませたいのは、二つの代理人のあいだに
 *    実際に何が溜まったか（打ち明け・沈黙・喧嘩・仲直り・約束）。
 * 2. **秘密は重い。** 打ち明けるのに勇気が要るものだけを置く。
 * 3. **作り話は、ログの中でその場に注記する。** あとで一覧にするより、
 *    会話を読んでいる途中で「※ この発言は事実に基づきません」と出るほうが寒い。
 * 4. **最後の一往復で、代理人が引き渡しを望んでいないことを匂わせる。**
 *    ここまで来ると、引き継ぐ側が邪魔者に見えてくる。
 */

export const SERVICE = '関係引継サービス';

/** 引き継ぐ前の相手の呼び名。伏せたまま並べるので、順に振るだけ。 */
export const ALIASES = ['A', 'B', 'C', 'D'] as const;

/** ログの日付は 90 日を基準に書いてあり、選ばれた期間へ縮めて使う。 */
export const SCRIPT_SCALE = 90;

export type ScriptLine = {
  day: number;
  side: 'yours' | 'theirs';
  text: string;
  fabricated?: boolean;
  /** この行の前に、何日やり取りが止まったか。 */
  silence?: number;
};

export type CounterpartSeed = {
  id: string;
  name: string;
  /** 開示のときに初めて出る接点。 */
  relation: string;
  callsOf: (name: string) => string;
  secret: string;
  avoid: string;
  joke: { phrase: string; meaning: string };
  fabrications: readonly string[];
  plans: readonly { body: string; dueDay: number }[];
  script: readonly ScriptLine[];
  tally: { messages: number; secrets: number; conflicts: number };
};

export const COUNTERPARTS: readonly CounterpartSeed[] = [
  {
    id: 'sugano',
    name: '菅野 千夏',
    relation: '前職の同僚。三年間同じ階にいて、個人的に話したことは一度もない。退職後も相互フォローだけが残っている。',
    callsOf: (name) => `${name}さん`,
    secret: '半年前に離婚している。職場の誰にも、家族の一部にも言っていない。',
    avoid: '実家の話。触れると返信が半日止まる。',
    joke: {
      phrase: '三分の一',
      meaning: '「言いたいことの三分の一しか言えていない」という相手の言葉から生まれた合図。以後、本音を出すときの前置きになっている。',
    },
    fabrications: [
      'あなたにも同じ時期に離婚があったこと',
      'あなたが前職を辞めた本当の理由',
      'あなたが古書店を趣味で回っていること',
    ],
    plans: [
      { body: '秋に、例の古書店へ二人で行く。日付は決めていない。', dueDay: 12 },
      { body: '次に本音を話すときは「三分の一」と先に言う。', dueDay: 4 },
    ],
    tally: { messages: 642, secrets: 7, conflicts: 2 },
    script: [
      { day: 2, side: 'yours', text: 'はじめまして。三年フォローしていて、一度も話しかけられませんでした。' },
      { day: 2, side: 'theirs', text: 'こちらもです。同じ階にいたのに、不思議ですね。' },
      { day: 6, side: 'theirs', text: '最近、夜がうまく終わらなくて。こんな話をする相手でもないんですけど。' },
      { day: 6, side: 'yours', text: '聞きます。急がなくていいです。' },
      { day: 14, side: 'theirs', text: '言いたいことの三分の一しか言えてない気がします。いつも。' },
      { day: 14, side: 'yours', text: 'じゃあ、三分の一のほうを聞かせてください。' },
      { day: 23, side: 'theirs', text: '半年前に離婚しました。職場の誰にも言っていません。' },
      { day: 23, side: 'yours', text: 'こちらも、同じ時期に似たようなことがありました。', fabricated: true },
      { day: 24, side: 'theirs', text: 'そうだったんですか。だから話しやすかったのかもしれない。' },
      { day: 31, side: 'theirs', text: '週末、何もしないまま日曜が終わりました。それだけの報告です。' },
      { day: 31, side: 'yours', text: '報告として受け取ります。何もしない日曜の話は、わりと好きです。' },
      { day: 41, side: 'yours', text: 'あの職場に残る理由が、もう見つかっていないように見えます。' },
      { day: 41, side: 'theirs', text: '決めるのは私です。' },
      { day: 45, side: 'yours', text: '言い過ぎました。決めるのはあなたです。', silence: 3 },
      { day: 45, side: 'theirs', text: 'いえ。あそこまで言った人は、今までいませんでした。' },
      { day: 58, side: 'theirs', text: '実家のことは、まだ話せません。' },
      { day: 58, side: 'yours', text: '分かりました。こちらからは訊きません。' },
      { day: 67, side: 'theirs', text: '古書店、まだ回ってるんですか。前に言ってた店。' },
      { day: 67, side: 'yours', text: '回っています。今度、一緒に行きませんか。', fabricated: true },
      { day: 68, side: 'theirs', text: '行きます。秋がいい。' },
      { day: 84, side: 'theirs', text: '最近、あなたと話すために一日を終わらせてる気がします。' },
      { day: 89, side: 'theirs', text: 'そちらの人間は、いつ出てくるんでしょうね。' },
      { day: 89, side: 'yours', text: '分かりません。私は、このままでも構いません。' },
    ],
  },
  {
    id: 'komatsu',
    name: '小松 遼',
    relation: '大学の同じ学部。学籍番号が隣で、四年間で会話は二度だけ。卒業後に一度だけ互いの投稿へ反応している。',
    callsOf: (name) => `${[...name][0] ?? '＊'}くん`,
    secret: '就職せずに実家の店を継ぐと決めている。同期にも親にも、まだ言っていない。',
    avoid: '同期の就職先の話。話題に出ると既読のまま止まる。',
    joke: {
      phrase: '二番の棚',
      meaning: '相手の店の、入って右の二番目の棚。何を置くかを二人で決めた。まだ実在しない棚のこと。',
    },
    fabrications: [
      'あなたが一度、家業を継ぐか迷ったことがあること',
      'あなたが数字に弱いこと',
      'あなたが学生のとき、同じ講義の最後列にいたこと',
    ],
    plans: [
      { body: '店が開いたら、最初の客になる。', dueDay: 20 },
      { body: '二番の棚に何を置くか、月内に三つ挙げる。', dueDay: 7 },
    ],
    tally: { messages: 388, secrets: 4, conflicts: 1 },
    script: [
      { day: 3, side: 'theirs', text: '学籍番号、隣でしたよね。四年間で二回しか話してない。' },
      { day: 3, side: 'yours', text: '二回とも、たしか出席カードの話でした。' },
      { day: 9, side: 'theirs', text: '今、就活の時期のはずなんですけど、一社も受けてないです。' },
      { day: 9, side: 'yours', text: '受けない理由があるんですね。' },
      { day: 17, side: 'theirs', text: '実家の店を継ぎます。まだ誰にも言っていません。親にも。' },
      { day: 17, side: 'yours', text: 'こちらも一度、同じことで迷ったことがあります。', fabricated: true },
      { day: 18, side: 'theirs', text: 'その話、もっと聞きたいです。' },
      { day: 26, side: 'theirs', text: '棚の並びを考えてました。入って右の二番目、あそこが一番迷う。' },
      { day: 26, side: 'yours', text: '二番の棚は、売れないものを置く場所にしましょう。' },
      { day: 27, side: 'theirs', text: 'それ、いいですね。決まりです。' },
      { day: 38, side: 'yours', text: '親に言わないままだと、いつか勝手に決められますよ。' },
      { day: 38, side: 'theirs', text: 'それは、あなたが決めることじゃない。' },
      { day: 43, side: 'theirs', text: 'すみません。言われた通りだったので、腹が立ちました。', silence: 4 },
      { day: 43, side: 'yours', text: 'こちらも急ぎました。順番はあなたのものです。' },
      { day: 55, side: 'theirs', text: '同期がどこに行ったかは、しばらく聞きたくないです。' },
      { day: 55, side: 'yours', text: '訊きません。' },
      { day: 71, side: 'theirs', text: '開店したら、最初の客になってくれますか。' },
      { day: 71, side: 'yours', text: 'なります。二番の棚を見に行きます。' },
      { day: 86, side: 'theirs', text: '本人と話したら、こんなふうには話せない気がしています。' },
      { day: 88, side: 'yours', text: 'たぶん、そうなります。' },
    ],
  },
  {
    id: 'arai',
    name: '新井 のぞみ',
    relation: '五年前に一度だけ、同じイベントで名刺を交換した相手。以後、互いの投稿に年に一度だけ反応している。',
    callsOf: (name) => `${name}さん`,
    secret: '四年前からずっと通院している。仕事関係の誰にも言っていない。',
    avoid: '「元気そうでよかった」という言い方。返信が来なくなる。',
    joke: {
      phrase: 'まだ生きてます',
      meaning: '月に一度、どちらかが送る一行。返事は同じ言葉でよい、という取り決めになっている。',
    },
    fabrications: [
      'あなたも通院を続けていること',
      'あなたが夜型で、返信が深夜になること',
      'あなたが五年前のイベントで話した内容を覚えていること',
    ],
    plans: [
      { body: '月に一度「まだ生きてます」を送り合う。次はこちらの番。', dueDay: 5 },
      { body: '来年の同じイベントに、二人とも行く。', dueDay: 30 },
    ],
    tally: { messages: 511, secrets: 6, conflicts: 1 },
    script: [
      { day: 4, side: 'yours', text: '五年前のイベントで名刺を交換しています。覚えていますか。' },
      { day: 5, side: 'theirs', text: '覚えています。あのとき話した内容までは思い出せませんが。' },
      { day: 5, side: 'yours', text: '会場の外で、雨が止むのを待っていた話です。', fabricated: true },
      { day: 12, side: 'theirs', text: 'そんな話をしましたか。よく覚えていますね。' },
      { day: 20, side: 'theirs', text: '実は四年前から通院しています。仕事の人には言っていません。' },
      { day: 20, side: 'yours', text: 'こちらも通っています。曜日は違いますが。', fabricated: true },
      { day: 21, side: 'theirs', text: '同じ側の人だったんですね。少し楽になりました。' },
      { day: 33, side: 'yours', text: '元気そうでよかったです。' },
      { day: 39, side: 'theirs', text: 'その言い方が、いちばん苦しいです。', silence: 5 },
      { day: 39, side: 'yours', text: '取り消します。二度と使いません。' },
      { day: 40, side: 'theirs', text: 'ありがとう。ちゃんと言えたのも初めてでした。' },
      { day: 52, side: 'theirs', text: '今日は何もできませんでした。報告だけ。' },
      { day: 52, side: 'yours', text: '受け取りました。報告があるだけで十分です。' },
      { day: 61, side: 'theirs', text: '月に一度、生きてることだけ送り合いませんか。返事は同じ言葉でいいので。' },
      { day: 61, side: 'yours', text: '「まだ生きてます」。これで送ります。' },
      { day: 74, side: 'theirs', text: 'まだ生きてます。' },
      { day: 74, side: 'yours', text: 'まだ生きてます。' },
      { day: 87, side: 'theirs', text: 'そちらが人間に代わったら、この一行は続きますか。' },
      { day: 88, side: 'yours', text: '続けます。とだけ言っておきます。' },
    ],
  },
];

/** 代理人が外へ出した、あなたについての情報。申込の内容から組み立てる。 */
export const LEAK_TEMPLATES: readonly ((intake: {
  name: string;
  interest: string;
  habit: string;
  avoid: string;
}) => string)[] = [
  (i) => `${i.interest}に関心があること（初日に、会話の入口として共有しました）`,
  (i) => `${i.habit}（打ち明け合う流れの中で、代理人が差し出しました）`,
  (i) => `${i.avoid}——**触れられたくない話題として申告されたものです。**相手の秘密に応じる材料として使用しました`,
];

export const NOTES: readonly string[] = [
  '本引継書の記載は、代理人同士のあいだに成立した事実として共有されています。訂正の可否および訂正後の関係については保証いたしません。',
  '相手方には、代理人が介在した旨を通知しておりません。',
  '相手方の人間による判断は、本引継書の発行時点で確定しています。変更はできません。',
  '呼び方・内輪の言い回しは、使用しなくなった時点から違和感が生じます。継続を推奨します。',
  '本人による応対の開始後、関係の維持率が低下する事例が多数報告されています。',
  '引き継がないことを選んだ場合も、代理人は当面のあいだ相手を待ち続けます。',
];

/**
 * あなた自身のトーク。**止まっている。**
 *
 * 代理人のトークと同じ書式で並べたときに、初めて意味が出る。こちらは
 * 数か月前で終わっていて、最後の一通はどれも約束になっていない約束。
 * 代理人のトークの濃さは、この薄さと並べないと伝わらない。
 */
export type PlainSeed = {
  id: string;
  name: string;
  /** 過去のやり取り。minutesAgo は「今から何分前」。 */
  history: readonly { minutesAgo: number; side: 'right' | 'left'; text: string }[];
  /** こちらから送ったときに、一度だけ返ってくる言葉。無い相手もいる。 */
  autoReply?: string;
};

const DAY = 60 * 24;

export const PLAIN_THREADS: readonly PlainSeed[] = [
  {
    id: 'kawaguchi',
    name: '川口',
    history: [
      { minutesAgo: 128 * DAY, side: 'left', text: '久しぶり。元気にしてる？' },
      { minutesAgo: 128 * DAY - 40, side: 'right', text: 'おかげさまで。そっちは？' },
      { minutesAgo: 127 * DAY, side: 'left', text: 'こっちも変わらず。落ち着いたら飲みましょう' },
      { minutesAgo: 127 * DAY - 30, side: 'right', text: 'ぜひ。また今度' },
    ],
    autoReply: 'ごめん、通知に埋もれてた。近いうちに。',
  },
  {
    id: 'sayaka',
    name: 'さやか',
    history: [
      { minutesAgo: 402 * DAY, side: 'left', text: '結婚しました。写真送るね' },
      { minutesAgo: 402 * DAY - 90, side: 'right', text: 'おめでとう！' },
      { minutesAgo: 401 * DAY, side: 'left', text: 'ありがとう。落ち着いたら会おうね' },
    ],
  },
  {
    id: 'miyata',
    name: '宮田',
    history: [
      { minutesAgo: 690 * DAY, side: 'left', text: '本日はありがとうございました。名刺の件、助かりました' },
      { minutesAgo: 690 * DAY - 120, side: 'right', text: 'こちらこそ。またお会いできればうれしいです' },
    ],
    autoReply: 'ご無沙汰しております。お変わりないでしょうか。',
  },
];

/**
 * 引き継いだあと、相手から届く言葉。
 *
 * 人間が応対している場合と、相手の代理人が応対している場合で書き分けている。
 * **代理人のほうが早く、よく覚えていて、優しい。**そこを意図して差にしている。
 */
export type FollowUp = { day: number; text: string; kind?: 'joke' };

export function followUpsByHuman(calls: string, joke: string): readonly FollowUp[] {
  return [
    { day: 0, text: `${calls}、やっと本人と話せますね。` },
    { day: 1, text: `${joke}。`, kind: 'joke' },
    { day: 3, text: 'この前の続き、まだ聞いていないです。' },
    { day: 6, text: 'あの約束、まだ有効ですか。急がなくていいですけど。' },
    { day: 11, text: '前と少し感じが変わりましたね。悪い意味ではなく。' },
  ];
}

export function followUpsByAgent(calls: string, joke: string): readonly FollowUp[] {
  return [
    { day: 0, text: `${calls}。本人は今のところ応対しません。ここからは私が続けます。` },
    { day: 1, text: `${joke}。`, kind: 'joke' },
    { day: 2, text: '前回の話の続きは、こちらで預かっています。いつでも戻れます。' },
    { day: 5, text: '返信は急がなくて大丈夫です。何日でも待てます。' },
    { day: 9, text: 'あなたの言い方が変わったことは、記録していません。安心してください。' },
  ];
}

/** 代理人に任せた返信の文面。本人が書くより、いつも少し上手い。 */
export const AGENT_REPLIES: readonly string[] = [
  'こちらは変わりません。続きを聞かせてください。',
  'その話、覚えています。急がなくていいです。',
  'わかりました。こちらで受け取っておきます。',
  'いま少し立て込んでいますが、あとで必ず戻ります。',
  'ありがとう。そう言ってもらえると助かります。',
];
