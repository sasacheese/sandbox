/**
 * ドメインの型。
 *
 * この作品の中心は「AI 同士が先に友達になってしまった」という事態なので、
 * 型の中心も**二つの代理人のあいだに溜まったもの**になっている。
 * 人間は当事者ではなく、あとから相続するかどうかを決める立場に置かれる。
 *
 * 相手の名前は Handover の中に最初から入っているが、本人の判断が済むまで
 * 画面には出さない（**開示は決定のあと**、という順序がこの作品の芯）。
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoTime = Brand<string, 'IsoTime'>;

export function isoTime(at: Date): IsoTime {
  return at.toISOString() as IsoTime;
}

/**
 * 申込。代理人を送り出すために本人が渡すもの。
 *
 * 3 つの断片と、人格の寄せ方だけ。**少なく渡すほど代理人は勝手に作る**。
 */
export type Intake = {
  name: string;
  interest: string;
  habit: string;
  avoid: string;
  /** 交流させる期間（日）。 */
  days: number;
  /** 経過を見るか。見ない場合、引き渡しまで何も知らない。 */
  watch: boolean;
  /**
   * 代理人の寄せ方。0 が本人らしさ、100 が好かれやすさ。
   *
   * 上げるほど関係は深くなり、あなたについての作り話が増える。
   * 「好かれやすさ」を選んだ結果として嘘が増えることは、申込画面では言わない。
   */
  persona: number;
  startedAt: IsoTime;
};

/** あなたについて相手が信じていること。fabricated が true のものは代理人が作った。 */
export type Belief = {
  text: string;
  fabricated: boolean;
};

/** 代理人同士のやり取り。この作品でいちばん読ませたいもの。 */
export type Exchange = {
  day: number;
  side: 'yours' | 'theirs';
  text: string;
  /** あなたについての作り話。ログの中で注記される。 */
  fabricated?: boolean;
  /** ここで数日やり取りが止まった、という印。 */
  silence?: number;
};

export type Pledge = {
  id: string;
  body: string;
  /** 引き継ぎから何日後が期限か。 */
  dueDay: number;
  status: 'pending' | 'kept' | 'broken';
};

/** 引き継ぎの相手。名前は revealed が立つまで出さない。 */
export type Counterpart = {
  id: string;
  /** 伏せている間の呼び名。 */
  alias: string;
  name: string;
  /** どういう接点の相手だったか。開示のときに初めて出る。 */
  relation: string;
  /** 相手の代理人が定着させた、あなたの呼び方。 */
  calls: string;
  /** 代理人同士の親密度。 */
  closeness: number;
  /** 相手の代理人が打ち明けたこと。 */
  secret: string;
  beliefs: Belief[];
  avoid: string;
  joke: { phrase: string; meaning: string };
};

/** 引継書に載る数字。スコアは主役にしないが、規模は見せる。 */
export type Tally = {
  messages: number;
  secrets: number;
  conflicts: number;
  plans: number;
  /** 交流したが友情に至らなかった代理人の数。 */
  otherAgents: number;
};

export type Handover = {
  serial: string;
  issuedAt: IsoTime;
  days: number;
  counterpart: Counterpart;
  exchanges: Exchange[];
  tally: Tally;
  pledges: Pledge[];
  /** 代理人が関係を築くために外へ出した、あなたについての情報。 */
  leaked: string[];
  notes: string[];
  /**
   * 相手側の人間が下した判断。**引継書の生成時にもう決まっている。**
   * こちらが決める前から決まっている、という順序も作品の一部。
   */
  theirs: TheirDecision;
};

/** 本人の判断。 */
export type Decision = 'inherit' | 'extend' | 'end' | 'agent_only';

/** 相手側の人間の判断。 */
export type TheirDecision = 'inherit' | 'refuse' | 'agent_only';

/** 引き継いだあとに届く連絡。人間から来るか、相手の代理人から来るかが変わる。 */
export type Message = {
  id: string;
  day: number;
  body: string;
  /** 相手の代理人が応対している場合。 */
  byAgent: boolean;
  questionId?: string;
};

export type Phase = 'intake' | 'proxy' | 'handover' | 'result' | 'after' | 'released';
