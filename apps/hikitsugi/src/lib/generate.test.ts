import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHandover,
  buildPlainThreads,
  buildProxyThread,
  buildProxyThreads,
  buildThreads,
  fabricationCount,
  seeded,
  theirDecisionOf,
  withState,
} from './generate.ts';
import { DEFAULT_LOOP_MS, plans } from './loop.ts';
import { isoTime, type Intake, type Thread } from './types.ts';

const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();
const NOW = new Date(START);

function intake(over: Partial<Intake> = {}): Intake {
  return {
    name: 'たつや',
    interest: '深夜のコインランドリー',
    habit: '本の角を折る',
    avoid: '実家のこと',
    persona: 50,
    startedAt: isoTime(new Date('2026-08-01T00:00:00.000Z')),
    ...over,
  };
}

function first(): Thread {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  return buildProxyThread(plan, 0, START);
}

test('最初から何本か動いていて、一本は満了している', () => {
  const threads = buildProxyThreads(NOW, START, LOOP);
  assert.ok(threads.length >= 2);
  const progress = threads.map((t) => t.headStart / (t.days ?? 1));
  assert.ok(progress.includes(1), '引き継げるものが一本も無い');
  assert.ok(progress.some((p) => p > 0 && p < 1), '途中のものが無い');
  // 名前は伏せない
  assert.ok(threads.every((t) => t.title.length > 1));
});

test('眺めているあいだにトークが増える', () => {
  const head = buildProxyThreads(NOW, START, LOOP).length;
  const middle = buildProxyThreads(new Date(START + LOOP * 0.5), START, LOOP).length;
  const end = buildProxyThreads(new Date(START + LOOP * 0.99), START, LOOP).length;
  assert.ok(middle > head);
  assert.equal(end, 9);
  // 出し切ると頭へ戻る
  assert.equal(buildProxyThreads(new Date(START + LOOP), START, LOOP).length, head);
});

test('トークごとに間隔と通数が割り当てられている', () => {
  const threads = buildProxyThreads(new Date(START + LOOP * 0.99), START, LOOP);
  assert.ok(threads.every((t) => t.gapMs > 0));
  assert.ok(new Set(threads.map((t) => t.gapMs)).size >= 5);
  // 満了済みの一本以外は、これから届くぶんを持っている
  assert.ok(threads.filter((t) => t.posts > 0).length >= 8);
});

test('自分のトークは止まったもので、既読で始まる', () => {
  const plain = buildPlainThreads(START);
  assert.ok(plain.length >= 2);
  assert.ok(plain.every((t) => t.kind === 'plain' && t.sent.length === 0));
  // 自分の過去のやり取りに未読が付くのはおかしい
  assert.ok(plain.every((t) => t.readAt !== undefined));
});

test('一覧は代理人のトークと自分のトークの両方を含む', () => {
  const threads = buildThreads(NOW, START, LOOP);
  assert.ok(threads.some((t) => t.kind === 'proxy'));
  assert.ok(threads.some((t) => t.kind === 'plain'));
  // 相手の名前は最初から出ている
  assert.ok(threads.filter((t) => t.kind === 'proxy').every((t) => t.title.length > 1));
});

test('相手側の判断は三通りあり、トークごとに決まっている', () => {
  const seen = new Set<string>();
  for (let s = 1; s < 60; s++) seen.add(theirDecisionOf(seeded(`s${s}`)));
  assert.deepEqual([...seen].sort(), ['agent_only', 'inherit', 'refuse']);
  for (const thread of buildProxyThreads(new Date(START + LOOP * 0.99), START, LOOP)) {
    assert.ok(['inherit', 'refuse', 'agent_only'].includes(thread.theirs ?? ''));
  }
});

test('同じ一巡のあいだは、同じトークから同じ書類が出る', () => {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  assert.deepEqual(buildProxyThread(plan, 0, START), buildProxyThread(plan, 0, START));
  assert.deepEqual(buildHandover(first(), intake()), buildHandover(first(), intake()));
});

test('一巡が変わると、書類番号も相手の判断もやり直しになる', () => {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  const serials = new Set([0, 1, 2, 3].map((loop) => buildProxyThread(plan, loop, START).serial));
  assert.ok(serials.size > 1, '巡が変わっても同じ書類が出ている');
});

test('好かれやすさを上げると作り話が増える', () => {
  assert.equal(fabricationCount(0), 1);
  assert.equal(fabricationCount(100), 3);
  const count = (persona: number) => buildHandover(first(), intake({ persona }))?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.ok(count(100) > count(0));
});

test('引継書には氏名・接点・沈黙の長さが入る', () => {
  const thread = first();
  const handover = buildHandover(thread, intake());
  assert.ok(handover);
  assert.equal(handover.name, thread.title);
  assert.ok(handover.relation.length > 0);
  assert.ok(handover.short.length > 0);
  assert.ok(handover.dormant.length > 0);
});

test('確認に答えるたび、相手が信じている作り話が減る', () => {
  const thread = first();
  const before = buildHandover(thread, intake({ persona: 100 }));
  const answered = buildHandover({ ...thread, answers: { x: 'yes', y: 'no' } }, intake({ persona: 100 }));
  const count = (h: typeof before) => h?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.ok(count(answered) < count(before), '答えても作り話が減らない');
});

test('答えない（skip）は作り話を減らさない', () => {
  const thread = first();
  const skipped = buildHandover({ ...thread, answers: { x: 'skip', y: 'skip' } }, intake({ persona: 100 }));
  const none = buildHandover(thread, intake({ persona: 100 }));
  const count = (h: typeof none) => h?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.equal(count(skipped), count(none));
});

test('触れられたくない話題が、相手の秘密に応じる材料として載る', () => {
  const handover = buildHandover(first(), intake({ avoid: '実家のこと' }));
  const leak = handover?.leaked.find((line) => line.includes('実家のこと'));
  assert.ok(leak);
  assert.match(leak, /触れられたくない話題として書かれたもの/);
});

test('自分のトークからは引継書が出ない', () => {
  const plain = buildPlainThreads(START)[0];
  assert.ok(plain);
  assert.equal(buildHandover(plain, intake()), null);
});

test('本人が触った跡は、組み立て直しても残る', () => {
  const thread = first();
  const applied = withState(thread, {
    sent: [{ id: 'me-1', at: isoTime(NOW), text: 'はじめまして', byAgent: false }],
    answers: { 'sugano-books': 'yes' },
    delta: -8,
    decision: 'inherit',
    inheritedAt: isoTime(NOW),
    readAt: isoTime(NOW),
  });
  assert.equal(applied.sent.length, 1);
  assert.equal(applied.decision, 'inherit');
  assert.equal(applied.answers['sugano-books'], 'yes');
  // 時間割から来るぶんは触らない
  assert.equal(applied.gapMs, thread.gapMs);
  assert.equal(applied.posts, thread.posts);
  assert.equal(applied.serial, thread.serial);
  // 跡が無ければ、まっさらのまま
  assert.deepEqual(withState(thread, undefined), thread);
});
