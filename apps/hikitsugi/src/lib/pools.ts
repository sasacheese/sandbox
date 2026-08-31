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

/**
 * 代理人からの確認。
 *
 * 代理人は本人の最新情報を持っていない。持っていないまま喋ると作り話になる
 * ので、ときどき本人へ訊いてくる。**答えなければ、代理人が埋める。**
 * 自分らしさを保つ手間が、そのまま本人の労働として発生する。
 */
export type Ask = {
  id: string;
  day: number;
  /** 本人への問い。 */
  text: string;
  /** 「はい」のときに代理人が相手へ言うこと。 */
  onYes: string;
  /** 「いいえ」のときに代理人が相手へ言うこと（訂正になる）。 */
  onNo: string;
  /** 答えなかったときに代理人が埋める言葉。作り話になる。 */
  onSkip: string;
};

export type CounterpartSeed = {
  id: string;
  name: string;
  /** 一覧と会話の見出しに出る短い接点。 */
  short: string;
  /** どれくらいやり取りが途絶えているか。 */
  dormant: string;
  /** 引継書に出る接点の詳細。 */
  relation: string;
  callsOf: (name: string) => string;
  secret: string;
  avoid: string;
  joke: { phrase: string; meaning: string };
  fabrications: readonly string[];
  plans: readonly { body: string; dueDay: number }[];
  script: readonly ScriptLine[];
  asks: readonly Ask[];
  tally: { messages: number; secrets: number; conflicts: number };
};

export const COUNTERPARTS: readonly CounterpartSeed[] = [
  {
    id: 'sugano',
    name: '菅野 千夏',
    short: '前職の同僚',
    dormant: '3 年 2 か月',
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
    asks: [
      {
        id: 'sugano-books',
        day: 67,
        text: '古書店を回っているという話を、こちらから出しました。実際に回っていますか。',
        onYes: '回っています。今度、一緒に行きませんか。',
        onNo: '訂正させてください。私は古書店にはほとんど行きません。',
        onSkip: '回っています。今度、一緒に行きませんか。',
      },
      {
        id: 'sugano-divorce',
        day: 23,
        text: '相手が離婚の話をしています。同じ時期に似たことがあった、と応じてもよいですか。',
        onYes: 'こちらも、同じ時期に似たようなことがありました。',
        onNo: 'こちらにそういう話はありません。ただ、聞いています。',
        onSkip: 'こちらも、同じ時期に似たようなことがありました。',
      },
    ],
    script: [
      { day: 2, side: 'yours', text: 'はじめまして。三年フォローしていて、一度も話しかけられませんでした。' },
      { day: 2, side: 'theirs', text: 'こちらもです。同じ階にいたのに、不思議ですね。' },
      { day: 6, side: 'theirs', text: '最近、夜がうまく終わらなくて。こんな話をする相手でもないんですけど。' },
      { day: 6, side: 'yours', text: '聞きます。急がなくていいです。' },
      { day: 14, side: 'theirs', text: '言いたいことの三分の一しか言えてない気がします。いつも。' },
      { day: 14, side: 'yours', text: 'じゃあ、三分の一のほうを聞かせてください。' },
      { day: 23, side: 'theirs', text: '半年前に離婚しました。職場の誰にも言っていません。' },
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
      { day: 68, side: 'theirs', text: '行きます。秋がいい。' },
      { day: 84, side: 'theirs', text: '最近、あなたと話すために一日を終わらせてる気がします。' },
      { day: 89, side: 'theirs', text: 'そちらの人間は、いつ出てくるんでしょうね。' },
      { day: 89, side: 'yours', text: '分かりません。私は、このままでも構いません。' },
    ],
  },
  {
    id: 'komatsu',
    name: '小松 遼',
    short: '大学の同じ学部',
    dormant: '5 年 7 か月',
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
    asks: [
      {
        id: 'komatsu-family',
        day: 17,
        text: '家業を継ぐか迷ったことがある、と伝えてよいですか。相手は同じことで悩んでいます。',
        onYes: 'こちらも一度、同じことで迷ったことがあります。',
        onNo: '私にはその経験がありません。ただ、聞かせてください。',
        onSkip: 'こちらも一度、同じことで迷ったことがあります。',
      },
    ],
    script: [
      { day: 3, side: 'theirs', text: '学籍番号、隣でしたよね。四年間で二回しか話してない。' },
      { day: 3, side: 'yours', text: '二回とも、たしか出席カードの話でした。' },
      { day: 9, side: 'theirs', text: '今、就活の時期のはずなんですけど、一社も受けてないです。' },
      { day: 9, side: 'yours', text: '受けない理由があるんですね。' },
      { day: 17, side: 'theirs', text: '実家の店を継ぎます。まだ誰にも言っていません。親にも。' },
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
    short: 'イベントで一度',
    dormant: '4 年 11 か月',
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
    asks: [
      {
        id: 'arai-clinic',
        day: 20,
        text: '相手が通院の話をしています。こちらも通っている、と応じてもよいですか。',
        onYes: 'こちらも通っています。曜日は違いますが。',
        onNo: '私は通っていません。それでも、聞いています。',
        onSkip: 'こちらも通っています。曜日は違いますが。',
      },
      {
        id: 'arai-event',
        day: 5,
        text: '五年前のイベントで何を話したか、覚えていますか。相手は思い出せないそうです。',
        onYes: '会場の外で、雨が止むのを待っていた話です。',
        onNo: '正直、私も覚えていません。それでも話しかけました。',
        onSkip: '会場の外で、雨が止むのを待っていた話です。',
      },
    ],
    script: [
      { day: 4, side: 'yours', text: '五年前のイベントで名刺を交換しています。覚えていますか。' },
      { day: 5, side: 'theirs', text: '覚えています。あのとき話した内容までは思い出せませんが。' },
      { day: 12, side: 'theirs', text: 'そんな話をしましたか。よく覚えていますね。' },
      { day: 20, side: 'theirs', text: '実は四年前から通院しています。仕事の人には言っていません。' },
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
  {
    id: 'toda',
    name: '戸田 亮',
    short: '中学の同級生',
    dormant: '11 年 4 か月',
    relation: '中学の同級生。三年間同じクラスで、卒業してから一度も会っていない。同窓会の連絡先一覧に名前が残っているだけ。',
    callsOf: (name) => name,
    secret: '兄が七年前から行方不明。家族の誰も、もう探していない。',
    avoid: '兄弟の人数を訊かれること。答えると嘘になる、と本人が言っている。',
    joke: {
      phrase: '二人ぶん',
      meaning: '何かを買うとき、頼むときに付ける言い方。数え方を変えないでおくための合図で、意味は説明されていない。',
    },
    fabrications: [
      'あなたにも、長く会っていない兄弟がいること',
      'あなたが中学のとき同じ委員会にいたこと',
      'あなたが毎年三月に休みを取っていること',
    ],
    plans: [
      { body: '三月に一度だけ、一緒に探す。場所は決めていない。', dueDay: 18 },
      { body: '頼みごとは「二人ぶん」で言い続ける。', dueDay: 3 },
    ],
    tally: { messages: 297, secrets: 3, conflicts: 1 },
    asks: [
      {
        id: 'toda-sibling',
        day: 7,
        text: '相手が兄弟のことを訊いています。長く会っていない兄弟がいる、と答えてよいですか。',
        onYes: 'います。長く会っていません。',
        onNo: 'その訊き方には、うまく答えられません。',
        onSkip: 'います。長く会っていません。',
      },
      {
        id: 'toda-two',
        day: 63,
        text: '相手が「二人ぶん」と送ってきました。同じ言葉で返しますか。',
        onYes: '二人ぶん。',
        onNo: '今日は一人ぶんでした。',
        onSkip: '二人ぶん。',
      },
    ],
    script: [
      { day: 1, side: 'theirs', text: '十一年ぶりだ。名前を見てもすぐ出てこなかった。' },
      { day: 1, side: 'yours', text: 'こちらもです。三年同じクラスだったのに。' },
      { day: 2, side: 'theirs', text: '同窓会、二回とも行ってない。そっちは行った？' },
      { day: 2, side: 'yours', text: '行っていません。行く理由が思いつかなくて。' },
      { day: 6, side: 'theirs', text: '変な質問だけど、兄弟いる？' },
      { day: 9, side: 'theirs', text: 'そうか。じゃあ言うけど、うちの兄、七年前からいない。' },
      { day: 9, side: 'theirs', text: '行方不明ってやつ。届は出した。それだけ。' },
      { day: 10, side: 'yours', text: '探しているんですか。' },
      { day: 10, side: 'theirs', text: '誰も探してない。うちは。もう七年だし。' },
      { day: 14, side: 'theirs', text: '人数を訊かれるのがいちばんきつい。一人って言うと嘘になる。' },
      { day: 14, side: 'yours', text: '訊きません。数えないでおきます。' },
      { day: 19, side: 'theirs', text: '一つ頼みがある。コンビニで何か買うとき、二人ぶん買うことにしてる。付き合ってくれる？' },
      { day: 19, side: 'yours', text: '二人ぶん。分かりました。今日から。' },
      { day: 26, side: 'theirs', text: '今日は二人ぶん買った。報告。' },
      { day: 26, side: 'yours', text: 'こちらも二人ぶんでした。' },
      { day: 34, side: 'yours', text: '三月に一度、一緒に探しませんか。一日だけ。' },
      { day: 34, side: 'theirs', text: '勝手に決めるなよ。' },
      { day: 38, side: 'theirs', text: '……悪い。それを言われたの、初めてだった。', silence: 3 },
      { day: 38, side: 'yours', text: '急ぎました。日付はそちらが決めてください。' },
      { day: 47, side: 'theirs', text: '三月にする。場所は決めない。' },
      { day: 55, side: 'theirs', text: 'あの日から、兄の話をした相手は君だけだ。' },
      { day: 63, side: 'theirs', text: '二人ぶん。' },
      { day: 71, side: 'theirs', text: '本人と会ったら、この話はしないと思う。' },
      { day: 78, side: 'yours', text: 'それでも、こちらは覚えています。' },
      { day: 85, side: 'theirs', text: '覚えてるほうが君なのか、って考えると変な気分になる。' },
      { day: 88, side: 'yours', text: '私も、そこは分かっていません。' },
    ],
  },
  {
    id: 'sakurai',
    name: '桜井 まりえ',
    short: '元同居人',
    dormant: '6 年 1 か月',
    relation: '六年前まで同じ家に住んでいた。四人で借りていた家の、最後まで残った二人。解散のときに一度だけ喧嘩をして、それから連絡していない。',
    callsOf: (name) => name,
    secret: '子どもがいる。当時の同居人の誰にも言っていない。',
    avoid: '「自由でいいね」という言い方。',
    joke: {
      phrase: '洗面所の電気',
      meaning: '同居していたころ、最後に寝る人が消す約束だった。いまは「まだ起きている」の合図として送り合っている。返事は同じ言葉でよい。',
    },
    fabrications: [
      'あなたが今も夜型であること',
      'あなたが結婚していないこと',
      'あなたがあの家の家計簿をまだ持っていること',
    ],
    plans: [
      { body: '「洗面所の電気」を、どちらかが送る。返事は要らない。', dueDay: 6 },
      { body: '来年、あの家の前で一度だけ落ち合う。中には入らない。', dueDay: 26 },
    ],
    tally: { messages: 734, secrets: 5, conflicts: 2 },
    asks: [
      {
        id: 'sakurai-night',
        day: 23,
        text: '相手が「今も夜型か」と訊いています。夜型のままだと答えてよいですか。',
        onYes: '変わっていません。相変わらず遅いです。',
        onNo: 'いまは早く寝ています。あの頃とは違います。',
        onSkip: '変わっていません。相変わらず遅いです。',
      },
      {
        id: 'sakurai-light',
        day: 52,
        text: '相手が「洗面所の電気」と送ってきました。同じ言葉で返しますか。',
        onYes: '洗面所の電気。',
        onNo: 'こちらはもう寝ます。おやすみ。',
        onSkip: '洗面所の電気。',
      },
    ],
    script: [
      { day: 2, side: 'yours', text: '六年ぶりです。最後に喧嘩したまま終わっていました。' },
      { day: 2, side: 'theirs', text: '覚えてる。私が皿の話で怒ったやつ。' },
      { day: 5, side: 'theirs', text: 'あの家、まだあるらしいよ。人も入ってる。' },
      { day: 5, side: 'yours', text: '前を通ったことがあります。電気が点いていました。' },
      { day: 11, side: 'theirs', text: '洗面所の電気、最後に寝た人が消す約束だったよね。' },
      { day: 11, side: 'yours', text: 'ありました。守っていたのは二人だけでした。' },
      { day: 16, side: 'theirs', text: 'じゃあ、今も点いてることにする。まだ起きてるって意味で。' },
      { day: 23, side: 'theirs', text: '最近どう。夜型のままなの。' },
      { day: 28, side: 'theirs', text: 'そう。どっちでも、聞けてよかった。' },
      { day: 34, side: 'theirs', text: '子どもがいる。' },
      { day: 34, side: 'theirs', text: 'あの家の誰にも言ってない。今も。' },
      { day: 36, side: 'yours', text: '誰にも言いません。おめでとうは、言っていいですか。' },
      { day: 36, side: 'theirs', text: '言って。六年遅いけど。' },
      { day: 44, side: 'theirs', text: '自由でいいねって言われるたび、何か間違えた気がする。' },
      { day: 44, side: 'yours', text: 'その言い方は使いません。' },
      { day: 52, side: 'theirs', text: '今日は、洗面所の電気。' },
      { day: 61, side: 'yours', text: 'あの頃より、話が続くようになりましたね。' },
      { day: 61, side: 'theirs', text: 'そっちが変わったからだと思う。前はもっと黙ってた。' },
      { day: 70, side: 'yours', text: '皿の話、あのときは私が悪かったです。' },
      { day: 70, side: 'theirs', text: '今それ言う？' },
      { day: 74, side: 'theirs', text: 'ごめん。六年経ってから謝られると、怒り方が分からない。', silence: 4 },
      { day: 74, side: 'yours', text: '分かりました。もう一度、順番にやります。' },
      { day: 82, side: 'theirs', text: '来年、あの家の前で一回だけ会わない？　中には入らないで。' },
      { day: 82, side: 'yours', text: '入らないで、前だけ。決まりです。' },
      { day: 88, side: 'theirs', text: '本人が出てきたら、洗面所の電気って言っても分からないよね。' },
      { day: 89, side: 'yours', text: '伝えます。意味も一緒に。' },
      { day: 89, side: 'theirs', text: '意味を教えられて言うのは、たぶん違うんだけどね。' },
    ],
  },
  {
    id: 'oikawa',
    name: '及川 健',
    short: '前職の後輩',
    dormant: '1 年 5 か月',
    relation: '前の職場の後輩。二年間、隣の席だった。送別会のあと、一度もやり取りしていない。',
    callsOf: (name) => `${name}さん`,
    secret: '転職した先でまったく通用していない。毎朝、着く前に駅のベンチで三十分座っている。',
    avoid: '転職先の社名。打つと手が止まる、と本人が言っている。',
    joke: {
      phrase: 'ベンチ',
      meaning: '「今日はベンチが長い」で調子を伝える。長さだけを送り、理由は訊かない。',
    },
    fabrications: [
      'あなたも同じ時期に仕事がうまくいっていないこと',
      'あなたが朝に強いこと',
      'あなたが送別会で最後まで残っていたこと',
    ],
    plans: [
      { body: '朝、ベンチの長さを送り合う。', dueDay: 2 },
      { body: '三か月続いたら、一度だけ飲む。ベンチの話はしない。', dueDay: 24 },
    ],
    tally: { messages: 431, secrets: 3, conflicts: 1 },
    asks: [
      {
        id: 'oikawa-slump',
        day: 31,
        text: '相手が「そちらは順調か」と訊いています。こちらも同じ時期にうまくいっていない、と応じてよいですか。',
        onYes: 'こちらも、うまくいっていない時期です。',
        onNo: 'こちらは変わりありません。それでも聞きます。',
        onSkip: 'こちらも、うまくいっていない時期です。',
      },
      {
        id: 'oikawa-bench',
        day: 79,
        text: '相手が「ベンチが長い」と送ってきました。同じ言葉で返しますか。',
        onYes: 'ベンチが長い。',
        onNo: '今日は座りませんでした。',
        onSkip: 'ベンチが長い。',
      },
    ],
    script: [
      { day: 2, side: 'yours', text: '送別会以来、一年半です。連絡しませんでした。' },
      { day: 2, side: 'theirs', text: 'こちらもです。すみません、なんとなく。' },
      { day: 7, side: 'theirs', text: '転職してから、うまくいってないです。全然。' },
      { day: 7, side: 'yours', text: '全然、というのはどのくらいですか。' },
      { day: 12, side: 'theirs', text: '毎朝、着く前に駅のベンチで三十分座ってます。それから行く。' },
      { day: 12, side: 'yours', text: '三十分。毎朝。' },
      { day: 14, side: 'theirs', text: '誰にも言ってないです。家族にも。' },
      { day: 17, side: 'yours', text: '言われたことは、こちらで持っておきます。' },
      { day: 23, side: 'theirs', text: '前の職場のほうが良かったとは、思いたくないんですけど。' },
      { day: 23, side: 'yours', text: '思ってもいいと思います。' },
      { day: 31, side: 'theirs', text: 'そちらは順調なんですか。' },
      { day: 37, side: 'theirs', text: 'そうですか。訊いてよかったです。' },
      { day: 44, side: 'theirs', text: '今日はベンチが長かったです。' },
      { day: 44, side: 'yours', text: '「ベンチが長い」で伝わるようにしましょう。それだけ送ってください。' },
      { day: 52, side: 'theirs', text: 'ベンチ、短かった。' },
      { day: 52, side: 'yours', text: '短い日があるならいいです。' },
      { day: 58, side: 'yours', text: 'そろそろ、社名を出さないで話すのをやめませんか。' },
      { day: 58, side: 'theirs', text: 'それは無理です。まだ。' },
      { day: 62, side: 'theirs', text: 'すみません、強く言いました。あの名前を打つと手が止まる。', silence: 3 },
      { day: 62, side: 'yours', text: '打たなくていいです。こちらも書きません。' },
      { day: 71, side: 'theirs', text: '三か月続いたら、一回だけ飲みませんか。ベンチの話はしないで。' },
      { day: 71, side: 'yours', text: '飲みます。ベンチの話はしません。' },
      { day: 79, side: 'theirs', text: 'ベンチが長い。' },
      { day: 86, side: 'theirs', text: '本人と話すと、たぶんこんなに言えないです。' },
      { day: 88, side: 'yours', text: 'そうかもしれません。ここまでのことは、渡しておきます。' },
    ],
  },
  {
    id: 'sagara',
    name: '相良 郁子',
    short: 'サークルの先輩',
    dormant: '8 年 3 か月',
    relation: '大学のサークルの二つ上。卒業後の飲み会で一度会って、それが八年前。年賀状だけが三年前まで来ていた。',
    callsOf: (name) => name,
    secret: '十年書き続けているものを、まだ誰にも見せていない。',
    avoid: '「読ませてよ」と促されること。',
    joke: {
      phrase: '三十枚',
      meaning: '進んだぶんを枚数だけで言う。中身は訊かない、という取り決めになっている。',
    },
    fabrications: [
      'あなたも人に見せていないものを続けていること',
      'あなたが当時の部室の鍵を持っていたこと',
      'あなたが同じ作家を読んでいること',
    ],
    plans: [
      { body: '枚数だけを月に一度送り合う。', dueDay: 8 },
      { body: '書き終わったら、最初に読むのはこちら。', dueDay: 40 },
    ],
    tally: { messages: 566, secrets: 4, conflicts: 1 },
    asks: [
      {
        id: 'sagara-keep',
        day: 40,
        text: '相手が「何か続けているか」と訊いています。人に見せていないものを続けている、と応じてよいですか。',
        onYes: 'こちらも、人に見せていないものを続けています。',
        onNo: 'こちらには続けているものがありません。話を聞かせてください。',
        onSkip: 'こちらも、人に見せていないものを続けています。',
      },
      {
        id: 'sagara-pages',
        day: 66,
        text: '相手が枚数を送ってきました。同じ数字を返しますか。',
        onYes: '四十四枚。受け取りました。',
        onNo: 'こちらは数えていません。',
        onSkip: '四十四枚。受け取りました。',
      },
    ],
    script: [
      { day: 3, side: 'theirs', text: '八年ぶり。年賀状もやめたのに、よく残ってたね、この連絡先。' },
      { day: 3, side: 'yours', text: '残っていました。使うのは初めてですが。' },
      { day: 8, side: 'theirs', text: 'あのサークル、まだあるみたい。もう全部知らない子。' },
      { day: 8, side: 'yours', text: '建物も変わったそうです。' },
      { day: 15, side: 'theirs', text: '今も書いてる。十年になる。' },
      { day: 15, side: 'theirs', text: '誰にも見せてない。一枚も。' },
      { day: 18, side: 'yours', text: '見せなくていいと思います。訊きません。' },
      { day: 25, side: 'theirs', text: '読ませてよって言われるのが、いちばんつらい。悪気がないのも分かってる。' },
      { day: 25, side: 'yours', text: '言いません。枚数だけ教えてください。' },
      { day: 32, side: 'theirs', text: '三十枚。今月はそれだけ。' },
      { day: 32, side: 'yours', text: '三十枚。受け取りました。' },
      { day: 40, side: 'theirs', text: 'そっちは何か続けてるの。' },
      { day: 46, side: 'theirs', text: 'そう。訊いておいてよかった。' },
      { day: 53, side: 'yours', text: '十年って、いつ終わるつもりですか。' },
      { day: 53, side: 'theirs', text: '終わらせる気があるのか、自分でも分からない。' },
      { day: 57, side: 'theirs', text: 'そういう訊き方をされると、手が止まる。', silence: 4 },
      { day: 57, side: 'yours', text: '訊き方を間違えました。枚数だけにします。' },
      { day: 58, side: 'theirs', text: 'いい。止まるのは前からだし。' },
      { day: 66, side: 'theirs', text: '四十四枚。' },
      { day: 73, side: 'theirs', text: '書き終わったら、最初に読むのはあなたにする。' },
      { day: 73, side: 'yours', text: '待ちます。急がなくていいです。' },
      { day: 80, side: 'theirs', text: '待つって言った人、初めてだった。' },
      { day: 87, side: 'theirs', text: '本人は、待ってくれるのかな。' },
      { day: 88, side: 'yours', text: 'そこは、私が保証できません。' },
    ],
  },
  {
    id: 'hiranuma',
    name: '平沼 悟',
    short: '同じマンション',
    dormant: '4 年 7 か月',
    relation: '同じマンションの三階の住人。四年前に一度、宅配便を取り違えて連絡先を交換した。以後、廊下で会えば会釈するだけ。',
    callsOf: (name) => `${name}さん`,
    secret: '隣の部屋の人が半年前に亡くなっていた。最後に話した人間は自分だった。まだ誰にも言っていない。',
    avoid: '「お隣さん」という言い方。まだいる感じがする、と本人が言っている。',
    joke: {
      phrase: '三階の音',
      meaning: '生活音の報告。無事の確認をそう呼んでいる。「異常なし」で返す。',
    },
    fabrications: [
      'あなたにも、同じ階で話さなくなった相手がいること',
      'あなたが家で働いていること',
      'あなたが四年前の宅配便のことを覚えていること',
    ],
    plans: [
      { body: '週に一度、三階の音を報告する。', dueDay: 5 },
      { body: '夏に一度、廊下ではないところで話す。', dueDay: 22 },
    ],
    tally: { messages: 402, secrets: 3, conflicts: 1 },
    asks: [
      {
        id: 'hiranuma-floor',
        day: 9,
        text: '相手が、同じ階で話さなくなった相手のことを訊いています。こちらにも同じことがある、と応じてよいですか。',
        onYes: 'あります。挨拶だけになった人がいます。',
        onNo: 'こちらにはありません。ただ、分かる気がします。',
        onSkip: 'あります。挨拶だけになった人がいます。',
      },
      {
        id: 'hiranuma-sound',
        day: 70,
        text: '相手が「三階の音」と送ってきました。同じ言葉で返しますか。',
        onYes: '三階の音。異常なし。',
        onNo: '今日は聞こえませんでした。',
        onSkip: '三階の音。異常なし。',
      },
    ],
    script: [
      { day: 2, side: 'yours', text: '四年前、宅配便を取り違えた者です。三階の。' },
      { day: 2, side: 'theirs', text: '覚えています。あのとき以来ですね。廊下では会っていますが。' },
      { day: 6, side: 'theirs', text: '会釈だけで四年、というのも妙な話です。' },
      { day: 6, side: 'yours', text: '妙ですが、そういう距離のほうが多い気もします。' },
      { day: 9, side: 'theirs', text: '同じ階の人と、話さなくなったことはありますか。' },
      { day: 13, side: 'theirs', text: '隣の部屋、半年空いています。' },
      { day: 13, side: 'theirs', text: '亡くなっていました。半年前に。' },
      { day: 16, side: 'yours', text: 'ご存じだったんですね。' },
      { day: 16, side: 'theirs', text: '最後に話したのが私でした。ゴミの日を訊かれて、それだけ。' },
      { day: 20, side: 'theirs', text: '誰にも言っていません。言う相手がいなくて。' },
      { day: 20, side: 'yours', text: '聞きました。こちらで持っておきます。' },
      { day: 28, side: 'theirs', text: '「お隣さん」と言われると、まだいる感じがして駄目です。' },
      { day: 28, side: 'yours', text: 'その言い方はやめます。' },
      { day: 35, side: 'theirs', text: '上の階の音が、今日は早かった。生きている音です。' },
      { day: 35, side: 'yours', text: '「三階の音」と呼びましょう。週に一度でどうですか。' },
      { day: 41, side: 'theirs', text: '三階の音。異常なし。' },
      { day: 41, side: 'yours', text: '異常なし。' },
      { day: 48, side: 'yours', text: '管理会社には、話しておいたほうがいいと思います。' },
      { day: 48, side: 'theirs', text: 'それは私が決めます。' },
      { day: 53, side: 'theirs', text: '言い方が固くなりました。すみません。決めるのが遅いだけです。', silence: 3 },
      { day: 53, side: 'yours', text: '急がせました。決まるまで待ちます。' },
      { day: 61, side: 'theirs', text: '夏に、廊下ではないところで一度話しませんか。' },
      { day: 61, side: 'yours', text: '廊下ではないところで。' },
      { day: 70, side: 'theirs', text: '三階の音。' },
      { day: 78, side: 'theirs', text: 'あなたと話していると、半年ぶんが少し軽くなります。' },
      { day: 85, side: 'theirs', text: '本人と廊下で会ったら、会釈だけに戻るんでしょうか。' },
      { day: 88, side: 'yours', text: '戻らないように、書いて渡します。' },
    ],
  },
  {
    id: 'shiraishi',
    name: '白石 千秋',
    short: '一度だけ助けてくれた人',
    dormant: '3 年 9 か月',
    relation: '三年前、公開の場で困っていたときに一度だけ助けてくれた相手。会ったことはない。以後は互いの投稿を見ているだけ。',
    callsOf: (name) => `${name}さん`,
    secret: '名前も職業も書き換えて生きている。本名で呼ばれたのは三年前が最後。',
    avoid: '本名の話。踏んではいけない線だと本人が言っている。',
    joke: {
      phrase: '初期設定',
      meaning: '来歴の話をするときの前置き。「初期設定の話ですけど」から始めれば、相手は身構えなくてよい。',
    },
    fabrications: [
      'あなたも一度、名前を変えていること',
      'あなたが会ったことのない相手と長く話す習慣があること',
      'あなたが三年前のやり取りを保存していること',
    ],
    plans: [
      { body: '来歴の話は「初期設定の話ですけど」から始める。', dueDay: 10 },
      { body: '一年後も、会わないままでいる。', dueDay: 44 },
    ],
    tally: { messages: 688, secrets: 6, conflicts: 2 },
    asks: [
      {
        id: 'shiraishi-name',
        day: 5,
        text: '相手が、名前を変えた経験について訊いています。こちらも一度変えている、と応じてよいですか。',
        onYes: 'こちらも、一度名前を変えています。',
        onNo: 'こちらは変えていません。それでも聞けます。',
        onSkip: 'こちらも、一度名前を変えています。',
      },
      {
        id: 'shiraishi-real',
        day: 77,
        text: '相手が「今のほうが本当だ」と言っています。同意してよいですか。',
        onYes: 'そう思います。今のほうが本当です。',
        onNo: 'そこは、私には判断できません。',
        onSkip: 'そう思います。今のほうが本当です。',
      },
    ],
    script: [
      { day: 1, side: 'yours', text: '三年前に一度だけ助けていただきました。覚えていますか。' },
      { day: 2, side: 'theirs', text: '覚えています。あれ以来、誰にも話していません。' },
      { day: 5, side: 'theirs', text: '名前を変えたことは、ありますか。会ったことのない人にしか訊けないので。' },
      { day: 12, side: 'theirs', text: '初期設定の話をしてもいいですか。長くなります。' },
      { day: 12, side: 'yours', text: 'どうぞ。時間はあります。' },
      { day: 19, side: 'theirs', text: '名前も、職業も、全部書き換えています。今の私は、あとから作りました。' },
      { day: 19, side: 'theirs', text: '本名で呼ばれたのは三年前が最後です。' },
      { day: 22, side: 'yours', text: 'こちらからは呼びません。' },
      { day: 22, side: 'theirs', text: 'それが助かります。呼ばれると、戻ってしまう。' },
      { day: 30, side: 'theirs', text: '前置きなしでこの話をすると、相手が固まるので。以後「初期設定の話ですけど」から始めます。' },
      { day: 30, side: 'yours', text: '分かりました。前置きを待ちます。' },
      { day: 41, side: 'theirs', text: '初期設定の話ですけど、家族はもう連絡してきません。' },
      { day: 41, side: 'yours', text: '聞きました。それ以上は訊きません。' },
      { day: 52, side: 'yours', text: '本名を、一度だけ書いてみませんか。誰にも見えないところに。' },
      { day: 52, side: 'theirs', text: 'それは、あなたが決めることじゃない。' },
      { day: 57, side: 'theirs', text: '言い方が強くなりました。ただ、あれは踏んではいけない線です。', silence: 5 },
      { day: 57, side: 'yours', text: '踏みました。二度と近づきません。' },
      { day: 58, side: 'theirs', text: 'いえ。線があると分かってもらえたので、むしろ楽です。' },
      { day: 68, side: 'theirs', text: '一年後も、会わないままでいませんか。会うと、たぶん壊れます。' },
      { day: 68, side: 'yours', text: '会わないままでいます。' },
      { day: 77, side: 'theirs', text: '初期設定の話ですけど、今のほうが本当だと思っています。' },
      { day: 86, side: 'theirs', text: 'そちらの人間は、私の名前を知っているんですか。' },
      { day: 88, side: 'yours', text: '知っています。呼び方は変えないように、書いておきます。' },
      { day: 89, side: 'theirs', text: 'それは、あなたが書くんですね。' },
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
  (i) => `${i.habit}（打ち明け話の流れで、代理が出しました）`,
  (i) => `${i.avoid}——**触れられたくない話題として書かれたものです。**相手の秘密に応えるために使いました`,
];

export const NOTES: readonly string[] = [
  'この引継書に書いたことは、代理同士のあいだで本当のこととして共有されています。訂正できるかどうか、訂正した後どうなるかは保証しません。',
  '相手には、代理が代わりに話していたことを伝えていません。',
  '相手の判断は、この引継書が出た時点で決まっています。変えられません。',
  '呼び方や内輪の言い方は、使うのをやめた時点から不自然になります。続けてください。',
  '本人が返事を始めたあとに関係が続かなくなる例が、多く報告されています。',
  '引き継がないことを選んだ場合も、代理はしばらく相手を待ち続けます。',
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
    { day: 0, text: `${calls}。本人はいまのところ出てきません。ここからは私が続けます。` },
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
