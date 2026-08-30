/**
 * 表示する流れを組み立てる。
 *
 * 配信されてくる feed.json（他の住人ぶん）と、この端末に置いてある自分の
 * 書き込みを一つの列にする。**画面の上で両者は区別されない。** それがこの
 * コミュニティの見え方そのものなので、混ぜる場所をここ一箇所に閉じてある。
 *
 * 自分の書き込みはどこへも送られないので、他の住人がそれに反応することはない。
 * 反応が返ってこないことに気づくかどうかは、使う人に委ねる。
 */

import type { Feed, Post, Reply, Resident } from './types.ts';

export type LocalPost = {
  id: string;
  at: string;
  body: string;
  photo?: string;
};

export type LocalReply = {
  id: string;
  postId: string;
  at: string;
  body: string;
};

export type Thread = Post & { mine: boolean };

/** 新しい順のスレッド一覧。自分の投稿と返信を差し込んで返す。 */
export function threads(feed: Feed, mine: { handle: string; posts: readonly LocalPost[]; replies: readonly LocalReply[] }): Thread[] {
  const byPost = new Map<string, Reply[]>();
  for (const reply of mine.replies) {
    const list = byPost.get(reply.postId) ?? [];
    list.push({ id: reply.id, author: mine.handle, at: reply.at, body: reply.body });
    byPost.set(reply.postId, list);
  }

  const remote: Thread[] = feed.posts.map((post) => ({
    ...post,
    mine: false,
    replies: sortByTime([...post.replies, ...(byPost.get(post.id) ?? [])]),
  }));

  const local: Thread[] = mine.posts.map((post) => ({
    id: post.id,
    author: mine.handle,
    at: post.at,
    body: post.body,
    ...(post.photo ? { photo: post.photo } : {}),
    likes: 0,
    mine: true,
    replies: sortByTime(byPost.get(post.id) ?? []),
  }));

  return [...remote, ...local].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? 1 : -1));
}

function sortByTime(replies: readonly Reply[]): Reply[] {
  return [...replies].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
}

export type ResidentView = Resident & { posts: number; lastAt: string | null; me: boolean };

/**
 * 住人一覧。投稿数の多い順。
 *
 * 自分も同じ表に並ぶ。数字が桁違いに小さいことに、ここで気づく。
 */
export function residents(feed: Feed, me: { handle: string; joinedAt: string; posts: number; lastAt: string | null }): ResidentView[] {
  const counts = new Map<string, { posts: number; lastAt: string | null }>();
  const bump = (handle: string, at: string) => {
    const current = counts.get(handle) ?? { posts: 0, lastAt: null };
    counts.set(handle, { posts: current.posts + 1, lastAt: current.lastAt === null || current.lastAt < at ? at : current.lastAt });
  };
  for (const post of feed.posts) {
    bump(post.author, post.at);
    for (const reply of post.replies) bump(reply.author, reply.at);
  }

  const list: ResidentView[] = feed.residents.map((resident) => {
    const count = counts.get(resident.handle) ?? { posts: 0, lastAt: null };
    return { ...resident, posts: count.posts, lastAt: count.lastAt, me: false };
  });

  list.push({
    handle: me.handle,
    joinedAt: me.joinedAt,
    bio: '',
    voice: '',
    posts: me.posts,
    lastAt: me.lastAt,
    me: true,
  });

  return list.sort((a, b) => b.posts - a.posts);
}

/** これから開かれる集まり。近い順。 */
export function upcoming(feed: Feed, now: Date): Feed['gatherings'] {
  return feed.gatherings
    .filter((g) => g.status === 'upcoming' && new Date(g.at).getTime() > now.getTime() - 6 * 3_600_000)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** 終わった集まり。新しい順。 */
export function past(feed: Feed, now: Date): Feed['gatherings'] {
  return feed.gatherings
    .filter((g) => g.status !== 'upcoming' || new Date(g.at).getTime() <= now.getTime() - 6 * 3_600_000)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
