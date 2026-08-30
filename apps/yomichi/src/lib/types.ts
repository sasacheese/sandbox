/**
 * ドメインの型。
 *
 * このコミュニティの投稿には 2 つの出どころがある。
 *
 * - **content/feed.json**：GitHub Actions が定期的に書き足していくもの。
 *   閲覧者から見れば「他の住人の投稿」で、全員ぶんがここに入っている。
 * - **IndexedDB**：この端末の持ち主が書いたもの。どこにも送られない。
 *
 * 型を分けずに同じ Post として扱うのは、画面の上で両者が区別されないから。
 * 区別されないことがこの作品の中身なので、実装でも混ぜてある。
 */

export type Resident = {
  handle: string;
  joinedAt: string;
  bio: string;
  /** 生成のときに渡す口調の指定。画面には出さない。 */
  voice: string;
};

export type Reply = {
  id: string;
  author: string;
  at: string;
  body: string;
};

export type Post = {
  id: string;
  author: string;
  at: string;
  body: string;
  /** 画像は data URL。生成側は付けない（作れないので）。 */
  photo?: string;
  replies: Reply[];
  likes: number;
  /** 集まりに紐づく投稿（告知・報告）。 */
  gatheringId?: string;
};

export type GatheringStatus = 'upcoming' | 'done' | 'cancelled';

export type Gathering = {
  id: string;
  title: string;
  at: string;
  place: string;
  by: string;
  note: string;
  attendees: string[];
  status: GatheringStatus;
};

export type Feed = {
  generatedAt: string;
  residents: Resident[];
  posts: Post[];
  gatherings: Gathering[];
};

/** この端末の持ち主。住人一覧では他の住人と同じ行に並ぶ。 */
export type Me = {
  handle: string;
  joinedAt: string;
};
