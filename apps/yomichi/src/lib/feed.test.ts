import assert from 'node:assert/strict';
import { test } from 'node:test';
import { past, residents, threads, upcoming } from './feed.ts';
import type { Feed } from './types.ts';

const feed: Feed = {
  generatedAt: '2026-08-30T23:10:00+09:00',
  residents: [
    { handle: 'みなと', joinedAt: '2025-11-03', bio: '', voice: '' },
    { handle: 'K.', joinedAt: '2025-11-08', bio: '', voice: '' },
  ],
  posts: [
    {
      id: 'p001',
      author: 'みなと',
      at: '2026-08-30T20:00:00+09:00',
      body: '柵が動いてる',
      likes: 3,
      replies: [{ id: 'r001', author: 'K.', at: '2026-08-30T21:00:00+09:00', body: '工程表を見てきて' }],
    },
    { id: 'p002', author: 'K.', at: '2026-08-30T22:00:00+09:00', body: '街灯が消えている', likes: 1, replies: [] },
  ],
  gatherings: [
    { id: 'g001', title: '歩く', at: '2026-08-23T21:00:00+09:00', place: '東中野', by: 'K.', note: '6 人', attendees: ['K.'], status: 'done' },
    { id: 'g002', title: '歩く', at: '2026-09-05T21:00:00+09:00', place: '中野', by: 'みなと', note: '', attendees: ['みなと'], status: 'upcoming' },
  ],
};

const mine = { handle: 'あなた', posts: [{ id: 'my1', at: '2026-08-30T21:30:00+09:00', body: 'はじめまして' }], replies: [] };

test('自分の投稿は他の住人と同じ列に並ぶ', () => {
  const list = threads(feed, mine);
  assert.deepEqual(list.map((t) => t.id), ['p002', 'my1', 'p001']);
  assert.equal(list.find((t) => t.id === 'my1')?.mine, true);
  assert.equal(list.find((t) => t.id === 'p002')?.mine, false);
});

test('自分の返信は相手のスレッドへ時系列で差し込まれる', () => {
  const list = threads(feed, {
    ...mine,
    replies: [{ id: 'mr1', postId: 'p001', at: '2026-08-30T20:30:00+09:00', body: '見ました' }],
  });
  const thread = list.find((t) => t.id === 'p001');
  assert.deepEqual(thread?.replies.map((r) => r.id), ['mr1', 'r001']);
  assert.equal(thread?.replies[0]?.author, 'あなた');
});

test('住人一覧は投稿数の多い順で、自分も同じ表に並ぶ', () => {
  const list = residents(feed, { handle: 'あなた', joinedAt: '2026-08-30', posts: 1, lastAt: '2026-08-30T21:30:00+09:00' });
  assert.deepEqual(list.map((r) => [r.handle, r.posts]), [
    ['K.', 2],
    ['みなと', 1],
    ['あなた', 1],
  ]);
  assert.equal(list.find((r) => r.me)?.handle, 'あなた');
});

test('集まりは開催前と終了後で分かれる', () => {
  const now = new Date('2026-08-30T23:00:00+09:00');
  assert.deepEqual(upcoming(feed, now).map((g) => g.id), ['g002']);
  assert.deepEqual(past(feed, now).map((g) => g.id), ['g001']);
});

test('終了時刻から 6 時間は開催中として扱う', () => {
  const during = new Date('2026-09-05T23:00:00+09:00');
  assert.deepEqual(upcoming(feed, during).map((g) => g.id), ['g002']);
  const after = new Date('2026-09-06T09:00:00+09:00');
  assert.deepEqual(upcoming(feed, after).map((g) => g.id), []);
});
