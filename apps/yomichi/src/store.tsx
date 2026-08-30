/**
 * 状態。
 *
 * 配信されてくる流れ（feed.json）は読むだけで、書き込めるのは自分のぶんだけ。
 * ここでの非対称は意図したものではなく、単に配信が静的だから——なのだが、
 * 使っているうちにその区別は見えなくなる。見えなくなることが、この作品の中身。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import feedJson from '../content/feed.json';
import residentsJson from '../content/residents.json';
import * as db from './lib/db.ts';
import type { LocalPost, LocalReply } from './lib/feed.ts';
import type { Feed, Me } from './lib/types.ts';

const KV_ME = 'me';
const KV_LIKES = 'likes';
const KV_ATTENDING = 'attending';

/** 配信されてきた流れ。ビルドに含まれているので、更新は再デプロイで届く。 */
export const FEED: Feed = { ...(feedJson as Omit<Feed, 'residents'>), residents: residentsJson as Feed['residents'] };

export type Store = {
  ready: boolean;
  persistent: boolean;
  feed: Feed;
  me: Me | null;
  posts: LocalPost[];
  replies: LocalReply[];
  likes: string[];
  attending: string[];

  join: (handle: string) => Promise<void>;
  rename: (handle: string) => Promise<void>;
  write: (input: { body: string; photo?: string }) => Promise<void>;
  reply: (postId: string, body: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleAttend: (gatheringId: string) => Promise<void>;
  wipe: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の外で useStore を呼んだ');
  return store;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<LocalPost[]>([]);
  const [replies, setReplies] = useState<LocalReply[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [attending, setAttending] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await db.isPersistent();
      if (cancelled) return;
      setPersistent(ok);
      if (!ok) return;
      db.requestPersistence().catch(() => undefined);
      const [loadedMe, loadedLikes, loadedAttending, loadedPosts, loadedReplies] = await Promise.all([
        db.readKv<Me>(KV_ME),
        db.readKv<string[]>(KV_LIKES),
        db.readKv<string[]>(KV_ATTENDING),
        db.readPosts(),
        db.readReplies(),
      ]);
      if (cancelled) return;
      setMe(loadedMe);
      if (loadedLikes) setLikes(loadedLikes);
      if (loadedAttending) setAttending(loadedAttending);
      setPosts(loadedPosts);
      setReplies(loadedReplies);
    })()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const join = useCallback(
    async (handle: string) => {
      const next: Me = { handle: handle.trim().slice(0, 16), joinedAt: new Date().toISOString() };
      setMe(next);
      if (persistent) await db.writeKv(KV_ME, next).catch(() => undefined);
    },
    [persistent],
  );

  const rename = useCallback(
    async (handle: string) => {
      if (!me) return;
      const next: Me = { ...me, handle: handle.trim().slice(0, 16) };
      setMe(next);
      if (persistent) await db.writeKv(KV_ME, next).catch(() => undefined);
    },
    [me, persistent],
  );

  const write = useCallback(
    async (input: { body: string; photo?: string }) => {
      const post: LocalPost = {
        id: newId('me'),
        at: new Date().toISOString(),
        body: input.body.trim(),
        ...(input.photo ? { photo: input.photo } : {}),
      };
      setPosts((prev) => [...prev, post]);
      if (persistent) await db.put(db.STORES.posts, post).catch(() => undefined);
    },
    [persistent],
  );

  const reply = useCallback(
    async (postId: string, body: string) => {
      const item: LocalReply = { id: newId('mr'), postId, at: new Date().toISOString(), body: body.trim() };
      setReplies((prev) => [...prev, item]);
      if (persistent) await db.put(db.STORES.replies, item).catch(() => undefined);
    },
    [persistent],
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      const next = likes.includes(postId) ? likes.filter((id) => id !== postId) : [...likes, postId];
      setLikes(next);
      if (persistent) await db.writeKv(KV_LIKES, next).catch(() => undefined);
    },
    [likes, persistent],
  );

  const toggleAttend = useCallback(
    async (gatheringId: string) => {
      const next = attending.includes(gatheringId) ? attending.filter((id) => id !== gatheringId) : [...attending, gatheringId];
      setAttending(next);
      if (persistent) await db.writeKv(KV_ATTENDING, next).catch(() => undefined);
    },
    [attending, persistent],
  );

  const wipe = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    setMe(null);
    setPosts([]);
    setReplies([]);
    setLikes([]);
    setAttending([]);
  }, [persistent]);

  const value = useMemo<Store>(
    () => ({
      ready,
      persistent,
      feed: FEED,
      me,
      posts,
      replies,
      likes,
      attending,
      join,
      rename,
      write,
      reply,
      toggleLike,
      toggleAttend,
      wipe,
    }),
    [attending, join, likes, me, persistent, posts, ready, rename, reply, replies, toggleAttend, toggleLike, wipe, write],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
