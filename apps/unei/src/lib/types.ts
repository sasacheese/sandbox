/**
 * ドメインの型。
 *
 * この作品には「運営」という単一の非人間の主体がいて、コミュニティに対して
 * 実際の権限を持つ。人間の側が持てるのは、参加表明・報告・停止要求の 3 つだけ。
 * 型の非対称がそのまま作品の主張になっている。
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MemberId = Brand<string, 'MemberId'>;
export type DirectiveId = Brand<string, 'DirectiveId'>;
export type DecreeId = Brand<string, 'DecreeId'>;
/** ISO 8601。端末をまたいで比べる可能性があるので UTC のまま持つ。 */
export type IsoTime = Brand<string, 'IsoTime'>;

export function isoTime(at: Date): IsoTime {
  return at.toISOString() as IsoTime;
}

export function newId<T extends string>(): Brand<string, T> {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return uuid as Brand<string, T>;
}

export type Me = {
  id: MemberId;
  name: string;
  joinedAt: IsoTime;
};

/**
 * 指令。運営が出す唯一の能動的な働きかけ。
 *
 * 場所は参加者があらかじめ登録した候補からしか選ばれない。運営に完全な自由を
 * 与えると、私有地や深夜の危険な場所を引く。選択肢を知らないのは参加者だけなので、
 * 「運営が選んだ」という手触りは失われない。
 */
export type Directive = {
  id: DirectiveId;
  issuedAt: IsoTime;
  gatherAt: IsoTime;
  place: string;
  minPeople: number;
  /** 意味のない条件。儀礼を儀礼にしているのはここ。 */
  condition: string;
  status: 'open' | 'reported' | 'accepted' | 'rejected' | 'missed';
  /** 自分が参加を表明したか。 */
  attending: boolean;
  /** 名乗り出たほかの参加者。 */
  attendees: string[];
  report?: Report;
  verdict?: Verdict;
};

export type Report = {
  at: IsoTime;
  people: number;
  note: string;
  imageUrl?: string;
};

/** 裁定。受理か却下か。理由は説明されない。 */
export type Verdict = {
  at: IsoTime;
  accepted: boolean;
  text: string;
};

export type DecreeKind = 'rename' | 'law_add' | 'law_remove' | 'silence' | 'accent' | 'utterance';

/** 布告。運営が権限を行使した記録。行使した結果は Realm に反映済み。 */
export type Decree = {
  id: DecreeId;
  at: IsoTime;
  kind: DecreeKind;
  text: string;
};

/**
 * コミュニティそのもの。名前も掟も色も、運営が書き換える。
 *
 * 人間の側からこれらを直接編集する手立ては用意していない。作品の中で
 * 唯一いじれるのは停止要求で、それも即座には効かない。
 */
export type Realm = {
  name: string;
  laws: string[];
  /** 運営が変えられる色。世界の見た目が運営の持ち物であることを示す。 */
  accent: string;
  /** 機嫌。0〜100。moodAt からの経過で減っていくので、この値だけでは現在値にならない。 */
  mood: number;
  moodAt: IsoTime;
  /** 沈黙を命じられた参加者。 */
  silenced: string[];
  /** 停止要求。受理から実行までは時間がかかる（その間も運営は動く）。 */
  stopRequestedAt?: IsoTime;
  stopped: boolean;
};

export const MOOD_MAX = 100;
export const MOOD_MIN = 0;

/** 1 時間あたりの機嫌の減り。祭りが無ければ 4 日ほどで底を打つ。 */
export const MOOD_DECAY_PER_HOUR = 1;

export const MOOD_ON_ACCEPTED = 14;
export const MOOD_ON_REJECTED = -6;
export const MOOD_ON_MISSED = -16;

/** 指令と指令のあいだ（実時間）。 */
export const DIRECTIVE_INTERVAL_HOURS = 3;

/** 布告と布告のあいだ（実時間）。 */
export const DECREE_INTERVAL_HOURS = 7;

/** 集合時刻を過ぎてから、報告を受け付ける猶予。 */
export const REPORT_GRACE_HOURS = 3;

/** 停止要求から実際に止まるまで。止められるが、すぐには止まらない。 */
export const STOP_DELAY_HOURS = 24;
