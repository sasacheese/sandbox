import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHandover, buildPlainThreads, buildProxyThreads, buildThreads, fabricationCount, seeded, theirDecisionOf } from './generate.ts';
import { isoTime, type Intake } from './types.ts';

const NOW = new Date('2026-08-31T12:00:00.000Z');

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

test('代理人のトークは三本、進み方がずれて始まる', () => {
  const threads = buildProxyThreads(NOW, seeded('x'));
  assert.equal(threads.length, 3);
  const progress = threads.map((t) => (t.headStart ?? 0) / (t.days ?? 1));
  assert.equal(progress[0], 1, '一本目は満了している');
  assert.ok((progress[1] ?? 0) > 0 && (progress[1] ?? 0) < 1, '二本目は途中');
  assert.ok((progress[2] ?? 1) < 0.3, '三本目は始まったばかり');
  // 名前は伏せない
  assert.ok(threads.every((t) => t.title.length > 1));
});

test('自分のトークは止まったもので、既読で始まる', () => {
  const plain = buildPlainThreads(NOW);
  assert.ok(plain.length >= 2);
  assert.ok(plain.every((t) => t.kind === 'plain' && t.sent.length === 0));
  // 自分の過去のやり取りに未読が付くのはおかしい
  assert.ok(plain.every((t) => t.readAt !== undefined));
});

test('一覧は代理人のトークと自分のトークの両方を含む', () => {
  const threads = buildThreads(NOW, seeded('y'));
  assert.ok(threads.some((t) => t.kind === 'proxy'));
  assert.ok(threads.some((t) => t.kind === 'plain'));
  // 相手の名前は最初から出ている
  assert.ok(threads.filter((t) => t.kind === 'proxy').every((t) => t.title.length > 1));
});

test('相手側の判断は三通りあり、トークごとに決まっている', () => {
  const seen = new Set<string>();
  for (let s = 1; s < 60; s++) seen.add(theirDecisionOf(seeded(`s${s}`)));
  assert.deepEqual([...seen].sort(), ['agent_only', 'inherit', 'refuse']);
  for (const thread of buildProxyThreads(NOW, seeded('z'))) {
    assert.ok(['inherit', 'refuse', 'agent_only'].includes(thread.theirs ?? ''));
  }
});

test('好かれやすさを上げると作り話が増える', () => {
  assert.equal(fabricationCount(0), 1);
  assert.equal(fabricationCount(100), 3);
  const thread = buildProxyThreads(NOW, seeded('q'))[0];
  assert.ok(thread);
  const shy = buildHandover(thread, intake({ persona: 0 }));
  const social = buildHandover(thread, intake({ persona: 100 }));
  const count = (h: typeof shy) => h?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.ok(count(social) > count(shy));
});

test('同じトークからは毎回同じ引継書が出る', () => {
  const thread = buildProxyThreads(NOW, seeded('r'))[0];
  assert.ok(thread);
  assert.deepEqual(buildHandover(thread, intake()), buildHandover(thread, intake()));
});

test('引継書には氏名・接点・沈黙の長さが入る', () => {
  const thread = buildProxyThreads(NOW, seeded('t'))[0];
  assert.ok(thread);
  const handover = buildHandover(thread, intake());
  assert.ok(handover);
  assert.equal(handover.name, thread.title);
  assert.ok(handover.relation.length > 0);
  assert.ok(handover.short.length > 0);
  assert.ok(handover.dormant.length > 0);
});

test('確認に答えるたび、相手が信じている作り話が減る', () => {
  const thread = buildProxyThreads(NOW, seeded('a'))[0];
  assert.ok(thread);
  const before = buildHandover(thread, intake({ persona: 100 }));
  const answered = buildHandover({ ...thread, answers: { x: 'yes', y: 'no' } }, intake({ persona: 100 }));
  const count = (h: typeof before) => h?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.ok(count(answered) < count(before), '答えても作り話が減らない');
});

test('答えない（skip）は作り話を減らさない', () => {
  const thread = buildProxyThreads(NOW, seeded('b'))[0];
  assert.ok(thread);
  const skipped = buildHandover({ ...thread, answers: { x: 'skip', y: 'skip' } }, intake({ persona: 100 }));
  const none = buildHandover(thread, intake({ persona: 100 }));
  const count = (h: typeof none) => h?.beliefs.filter((b) => b.fabricated).length ?? 0;
  assert.equal(count(skipped), count(none));
});

test('触れられたくない話題が、相手の秘密に応じる材料として載る', () => {
  const thread = buildProxyThreads(NOW, seeded('u'))[0];
  assert.ok(thread);
  const handover = buildHandover(thread, intake({ avoid: '実家のこと' }));
  const leak = handover?.leaked.find((line) => line.includes('実家のこと'));
  assert.ok(leak);
  assert.match(leak, /触れられたくない話題として申告/);
});

test('自分のトークからは引継書が出ない', () => {
  const plain = buildPlainThreads(NOW)[0];
  assert.ok(plain);
  assert.equal(buildHandover(plain, intake()), null);
});
