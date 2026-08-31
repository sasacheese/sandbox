/**
 * ドメインの型。
 *
 * 画面は普通のメッセンジャーに見えるようにしてある。**トークが二種類ある**
 * ことだけが普通ではない。
 *
 * - `plain`：あなた自身のトーク。自分で打つ。止まっている。
 * - `proxy`：あなたの代理人が、相手の代理人と続けているトーク。
 *   自分では打てない。相手が誰かも分からない。こちらのほうが濃い。
 *
 * 同じ一覧の書式で並ぶので、二つを見比べたときに何が起きているかが分かる。
 * 引き継ぐと proxy が plain の側へ移る——**タブの移動が引き継ぎそのもの**。
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoTime = Brand<string, 'IsoTime'>;

export function isoTime(at: Date): IsoTime {
  return at.toISOString() as IsoTime;
}

export type Intake = {
  name: string;
  interest: string;
  habit: string;
  avoid: string;
  /** 代理人の寄せ方。0 が本人らしさ、100 が好かれやすさ。 */
  persona: number;
  startedAt: IsoTime;
};

export type Belief = {
  text: string;
  fabricated: boolean;
};

/** 相手側の人間の判断。引き継ぎを申し出た時点でもう決まっている。 */
export type TheirDecision = 'inherit' | 'refuse' | 'agent_only';

/** 本人の判断。 */
export type Decision = 'inherit' | 'extend' | 'end' | 'agent_only';

/** 自分が打ったもの、または代理人に打たせたもの。 */
export type Sent = {
  id: string;
  at: IsoTime;
  text: string;
  /** 代理人に任せた返信。 */
  byAgent: boolean;
};

/** 画面に出す一通。トークの種類にかかわらずこの形へ落とす。 */
export type Bubble = {
  id: string;
  /** right が自分の側（代理人が書いたぶんもここに来る）。 */
  side: 'right' | 'left';
  text: string;
  at: IsoTime;
  /** 日付の区切り。前の一通と変わったときだけ表示する。 */
  dayLabel: string;
  /** 代理人が書いたもの。 */
  byAgent: boolean;
  /** この発言は事実に基づかない、という注記を付ける。 */
  fabricated?: boolean;
  /** 何日か間が空いたことを示す。 */
  silence?: number;
  /** この一通の前に挟む仕切り（引き継ぎの位置）。 */
  divider?: string;
  /**
   * 代理人からの確認。吹き出しではなく、本人への問いとして描く。
   *
   * 答えなければ代理人が勝手に埋める（そのとき、同じ文が作り話になる）。
   * **同じ一文が、答えたかどうかで事実にも嘘にもなる**のがこの作りの要点。
   */
  ask?: { id: string; text: string; answered?: AskAnswer; autoFilled?: boolean };
};

export type AskAnswer = 'yes' | 'no' | 'skip';

export type ThreadKind = 'plain' | 'proxy';

export type Thread = {
  id: string;
  kind: ThreadKind;
  /** 相手の名前。伏せない（伏せる制度上の理由が無いため）。 */
  title: string;
  /** proxy のときだけ。lib/pools.ts の相手の id。 */
  seedId?: string;
  /** proxy のときだけ。交流期間（日）。 */
  days?: number;
  /**
   * 交流がどこまで進んでいたか。
   *
   * 経過は「作られた時刻からの実時間 ÷ 一日の長さ」＋ headStart で出す。
   * 一日の長さは設定で変えられるので、開始時刻を実時刻で持つと、倍率を
   * 変えたときに進行が巻き戻る。**進んだ日数を持つ**ほうが壊れない。
   */
  createdAt: IsoTime;
  headStart: number;
  /** proxy のときだけ。相手側の人間の判断。 */
  theirs?: TheirDecision;
  serial?: string;
  /** 本人の判断。決めるまで undefined。 */
  decision?: Decision;
  inheritedAt?: IsoTime;
  /** 引き継いだあとの親密度の増減。 */
  delta: number;
  /** 自分が打ったもの。 */
  sent: Sent[];
  /** 代理人からの確認への答え。 */
  answers: Record<string, AskAnswer>;
  /** 既読にした時刻。未読の数を出すために持つ。 */
  readAt?: IsoTime;
};

/** 引継書。proxy のトークから開く。 */
export type Handover = {
  threadId: string;
  serial: string;
  days: number;
  name: string;
  short: string;
  dormant: string;
  relation: string;
  calls: string;
  closeness: number;
  secret: string;
  beliefs: Belief[];
  avoid: string;
  joke: { phrase: string; meaning: string };
  plans: string[];
  tally: { messages: number; secrets: number; conflicts: number; otherAgents: number };
  leaked: string[];
  notes: string[];
  theirs: TheirDecision;
};
