/**
 * ドメインの型。
 *
 * このサービスが渡すのは「関係」ではなく**引継書**という書類なので、型の中心は
 * Handover。関係そのものはこの書類の中にしか無く、本人は書類を読んで初めて、
 * 自分が誰と何を共有したことになっているかを知る。
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoTime = Brand<string, 'IsoTime'>;

export function isoTime(at: Date): IsoTime {
  return at.toISOString() as IsoTime;
}

/**
 * 申込。本人が代行へ渡す自分の断片。
 *
 * 3 つしか聞かない。**少なく渡すほど、代行は残りを勝手に作る**という設計で、
 * 申込書の注意書きにもそう書いてある。読まずに進める人が多いだろうが、
 * それも含めて同意の形として置いている。
 */
export type Intake = {
  name: string;
  /** 最近気になっていること。関係の入口として使われる。 */
  interest: string;
  /** 人に言っていない癖。 */
  habit: string;
  /** 触れられたくない話題。 */
  avoid: string;
  /** 代行期間（日）。 */
  days: number;
  /** 経過を見るか。見ない場合、引き渡しの瞬間まで何も知らない。 */
  watch: boolean;
  startedAt: IsoTime;
};

/** あなたについて相手が信じていること。fabricated が true のものは代行が作った。 */
export type Belief = {
  text: string;
  fabricated: boolean;
};

export type Companion = {
  id: string;
  name: string;
  profile: string;
  /** 代行期間に定着したあなたの呼び方。本人が知らない自分の呼び名。 */
  calls: string;
  /** 親密度。引き継いだあとの受け答えで上下する。 */
  closeness: number;
  /** 代行期間の何日目に関係が始まったか。 */
  metDay: number;
  shared: string[];
  /** 相手があなたに打ち明けたこと。あなたは預かっている。 */
  secret: string;
  beliefs: Belief[];
  /** 触れてはいけないこと。 */
  avoid: string;
  /** 内輪のネタ。説明されないと意味が分からない。 */
  joke: { phrase: string; meaning: string };
};

export type PromiseStatus = 'pending' | 'kept' | 'broken';

export type Pledge = {
  id: string;
  to: string;
  body: string;
  /** 引き継ぎから何日後が期限か。 */
  dueDay: number;
  status: PromiseStatus;
};

export type LogEntry = {
  day: number;
  text: string;
};

/** 引継書。この作品の本体。 */
export type Handover = {
  serial: string;
  issuedAt: IsoTime;
  community: string;
  days: number;
  companions: Companion[];
  pledges: Pledge[];
  /** 代行が関係を築くために外へ出した、あなたについての情報。 */
  leaked: string[];
  notes: string[];
  log: LogEntry[];
};

/** 引き継いだあとに届く連絡。相手からの呼びかけ。 */
export type Contact = {
  id: string;
  from: string;
  at: IsoTime;
  body: string;
  /** 確認を含む連絡かどうか。 */
  asks: boolean;
};

export type Phase = 'intake' | 'proxy' | 'handover' | 'after';
