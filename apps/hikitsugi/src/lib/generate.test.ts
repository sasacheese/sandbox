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
  assert.deepEqual(threads.map((t) => t.title), ['A', 'B', 'C']);
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
  // 代理人のトークの相手は伏せられている
  assert.ok(threads.filter((t) => t.kind === 'proxy').every((t) => ['A', 'B', 'C', 'D'].includes(t.title)));
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

test('引継書には氏名と接点が入っているが、トークの表題は伏せたまま', () => {
  const thread = buildProxyThreads(NOW, seeded('t'))[0];
  assert.ok(thread);
  const handover = buildHandover(thread, intake());
  assert.ok(handover);
  assert.ok(handover.name.length > 0);
  assert.ok(handover.relation.length > 0);
  assert.equal(handover.alias, thread.title);
  assert.notEqual(handover.name, thread.title);
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
