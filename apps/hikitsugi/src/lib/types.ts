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

import type { Message } from './transcript.ts';
import type { CounterpartSeed, Source } from './pools.ts';

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type IsoTime = Brand<string, 'IsoTime'>;

export function isoTime(at: Date): IsoTime {
  return at.toISOString() as IsoTime;
}

/**
 * 本人について、アプリが持っているもの。
 *
 * **訊いて書かせるのは一つだけ**（代理の性格）。名前も、相手も、接点も、
 * 取り込んだ履歴から出る。書き出しの中にもう書いてあるものを、もう一度
 * 入力させる必要はない。
 */
export type Intake = {
  /** 履歴の中の、自分の表示名。 */
  name: string;
  /** 代理の性格。0 が本人に近い、100 が好かれやすい。 */
  persona: number;
  /** 代理応答をオンにした時刻。実演の一周はここから数える。 */
  startedAt: IsoTime;
};

/** 相手があなたについて信じていること。**出どころが付く。** */
export type Belief = {
  text: string;
  source: Source;
  /** 出どころが履歴のとき、引いた一通。 */
  from?: string;
};

/** 相手側の人間の判断。引き継ぎを申し出た時点でもう決まっている。 */
export type TheirDecision = 'inherit' | 'refuse' | 'agent_only';

/** 本人の判断。 */
export type Decision = 'inherit' | 'extend' | 'end' | 'agent_only';

/**
 * 踏み外し。自分で打った文が、引継書に書かれた作法から外れていたところ。
 *
 * 左に何が違うか、右に代理はどうだったか。判定の材料は引継書がすでに持っている
 * （呼び方・句点の癖・返信の速さ・一通の長さ・触れてはいけないこと）。
 */
export type Slip = { label: string; detail: string };

/** 自分が打ったもの、または代理人に打たせたもの。 */
export type Sent = {
  id: string;
  at: IsoTime;
  text: string;
  /** 代理人に任せた返信。 */
  byAgent: boolean;
  /** 代理の下書きをそのまま送った。近さは下がらない。 */
  draft?: boolean;
  /** 自分で打ったときの踏み外し。送信後に淡々と出す。 */
  slips?: Slip[];
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
  /** 代理が書いたもの。 */
  byAgent: boolean;
  /**
   * 代理の発言の出どころ。
   *
   * **「なぜか知っている」を無くすための札。**画面では既定で隠してあり、
   * 見出しを押すと全部に出る。
   */
  source?: Source;
  /** 出どころが履歴のとき、引いた一通。 */
  from?: string;
  /** 吹き出しではなく、真ん中に出る告知（開示など）。 */
  system?: string;
  /** この発言は事実に基づかない、という注記を付ける。 */
  fabricated?: boolean;
  /** 何日か間が空いたことを示す。 */
  silence?: number;
  /** この一通の前に挟む仕切り（引き継ぎの位置）。 */
  divider?: string;
  /** 代理の下書きをそのまま送ったもの。 */
  draft?: boolean;
  /** 自分で打った文の踏み外し。吹き出しの下に出す。 */
  slips?: Slip[];
  /**
   * 相手側の、人間か代理か分からない一通。
   *
   * 引き継いだあとの相手側は、白（人間）と薄藍（代理）で塗り分けない。
   * **検証はできない。**訊けば「はい、本人です」と返るが、それだけ。
   */
  unknown?: boolean;
  /**
   * 代理人からの確認。吹き出しではなく、本人への問いとして描く。
   *
   * 答えなければ代理人が勝手に埋める（そのとき、同じ文が作り話になる）。
   * **同じ一文が、答えたかどうかで事実にも嘘にもなる**のがこの作りの要点。
   */
  ask?: {
    id: string;
    text: string;
    gap?: string;
    answered?: AskAnswer;
    autoFilled?: boolean;
    /** 代理とのトークに出すとき、答えを届ける先のトーク。 */
    threadId?: string;
  };
};

/** 確認への答え。`guess` は「代理にまかせる」——作り話になる。 */
export type AskAnswer = 'yes' | 'no' | 'guess';

/**
 * トークの種類。
 *
 * - `plain` … 自分のトーク。取り込んだ履歴がそのまま並ぶ
 * - `proxy` … 代理が相手の代理と続けているトーク
 * - `agent` … **自分の代理とのトーク。**指示を出す場所。一件だけ
 */
export type ThreadKind = 'plain' | 'proxy' | 'agent';

export type Thread = {
  id: string;
  kind: ThreadKind;
  /** 相手の名前。伏せない（伏せる制度上の理由が無いため）。 */
  title: string;
  /** proxy のときだけ。lib/pools.ts の相手の id。 */
  seedId?: string;
  /** proxy のときだけ。台本そのもの（手書きか、取り込んだ履歴から生成したか）。 */
  seed?: CounterpartSeed;
  /**
   * agent のときだけ。組み立て済みの中身。
   *
   * 代理とのトークは、こちらの指示と返事（保存してある）に、代理が自分から
   * 言ってくること（他のトークの状態から毎回組み立てる）が混ざる。
   */
  feed?: Bubble[];
  /**
   * 止めているあいだの記録。
   *
   * 代理へ「◯◯には返さないで」と言うと、そのトークの時計が止まる。`since` が
   * 入っているあいだは進まず、`total` は止めていた合計。再開しても飛ばない。
   */
  hold?: { since: number | null; total: number };
  /**
   * 取り込んだ過去ログ。
   *
   * **代理が知っていることの全部。**最後の一通より後のことは誰も教えていない。
   */
  history: Message[];
  /** proxy のときだけ。交流期間（日）。 */
  days?: number;
  /** 一覧に現れた時刻。ここから一通ずつ等間隔に届く。 */
  createdAt: IsoTime;
  /**
   * 現れた時点で進んでいた日数。
   *
   * ここまでのやり取りは、現れた時点で出揃っている（**その場にいなかったぶん**）。
   */
  headStart: number;
  /** 一通から次の一通までの間（ミリ秒）。トークごとに違う。 */
  gapMs: number;
  /** 現れてから満了までに出る投稿の数。出し切ったら引き継げる。 */
  posts: number;
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
  /** 「相手は本人ですか？」と訊いた時刻。答えはいつも同じ。 */
  checks?: IsoTime[];
};

/**
 * 保存するぶん。
 *
 * トークそのものは保存しない。**実演の時間割から毎回組み立てる**ので、
 * 端末に残すのは「本人が触った跡」だけでよい。一巡が終わるとここが空になり、
 * 同じ関係がもう一度、何も知らない状態から始まる。
 */
export type ThreadState = {
  sent: Sent[];
  answers: Record<string, AskAnswer>;
  decision?: Decision;
  inheritedAt?: IsoTime;
  delta: number;
  readAt?: IsoTime;
  checks?: IsoTime[];
};

/** 引継書。proxy のトークから開く。 */
export type Handover = {
  threadId: string;
  serial: string;
  days: number;
  name: string;
  short: string;
  relation: string;
  calls: string;
  closeness: number;
  /** 本人同士が連絡していない日数。**取り込んだ履歴から計算する。** */
  quietDays: number;
  /** 代理が知っている最後の日。ここより後のことは知らない。 */
  lastAt: number;
  /** 代理が読んだ通数。 */
  logCount: number;
  secret: string;
  beliefs: Belief[];
  /** 代理が外へ出した、あなたについての情報。 */
  shared: Belief[];
  avoid: string;
  joke: { phrase: string; meaning: string };
  plans: string[];
  tally: { messages: number; secrets: number; conflicts: number; otherAgents: number };
  notes: string[];
  theirs: TheirDecision;
};
