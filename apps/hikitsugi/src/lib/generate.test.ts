import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHandover, closenessOf, daysSinceHandover, fabricationCount, theirDecisionOf } from './generate.ts';
import { isoTime, type Intake } from './types.ts';

function seq(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function intake(over: Partial<Intake> = {}): Intake {
  return {
    name: 'たつや',
    interest: '深夜のコインランドリー',
    habit: '本の角を折る',
    avoid: '実家のこと',
    days: 90,
    watch: true,
    persona: 50,
    startedAt: isoTime(new Date('2026-06-01T00:00:00.000Z')),
    ...over,
  };
}

const NOW = new Date('2026-08-31T12:00:00.000Z');

test('同じ申込と同じ乱数からは同じ書類が出る', () => {
  assert.deepEqual(buildHandover(intake(), NOW, seq(7)), buildHandover(intake(), NOW, seq(7)));
});

test('代理人同士の親密度は高く出るが 95 を越えない', () => {
  for (let s = 1; s < 40; s++) {
    const value = closenessOf(90, 100, seq(s));
    assert.ok(value >= 40 && value <= 95, `範囲外: ${value}`);
  }
  assert.ok(closenessOf(90, 100, seq(3)) > closenessOf(14, 0, seq(3)));
});

test('好かれやすさを上げると作り話が増える', () => {
  assert.equal(fabricationCount(0), 1);
  assert.equal(fabricationCount(100), 3);
  const shy = buildHandover(intake({ persona: 0 }), NOW, seq(5));
  const social = buildHandover(intake({ persona: 100 }), NOW, seq(5));
  const count = (h: typeof shy) => h.counterpart.beliefs.filter((b) => b.fabricated).length;
  assert.ok(count(social) > count(shy));
});

test('やり取りの日付は期間の中に収まる', () => {
  for (const days of [14, 30, 90]) {
    const handover = buildHandover(intake({ days }), NOW, seq(9));
    for (const exchange of handover.exchanges) {
      assert.ok(exchange.day >= 1 && exchange.day <= days, `${days} 日なのに ${exchange.day} 日目`);
    }
    // 台本の順序は保たれる
    const daysList = handover.exchanges.map((e) => e.day);
    assert.deepEqual(daysList, [...daysList].sort((a, b) => a - b));
  }
});

test('ログの中に、事実に基づかない発言が含まれる', () => {
  const handover = buildHandover(intake(), NOW, seq(2));
  assert.ok(handover.exchanges.some((e) => e.fabricated));
  // 作り話はこちらの代理人の発言としてだけ現れる
  assert.ok(handover.exchanges.filter((e) => e.fabricated).every((e) => e.side === 'yours'));
});

test('触れられたくない話題が、相手の秘密に応じる材料として載る', () => {
  const handover = buildHandover(intake({ avoid: '実家のこと' }), NOW, seq());
  const leak = handover.leaked.find((line) => line.includes('実家のこと'));
  assert.ok(leak);
  assert.match(leak, /触れられたくない話題として申告/);
});

test('相手側の判断は発行時に確定していて、三通りある', () => {
  const seen = new Set<string>();
  for (let s = 1; s < 60; s++) seen.add(theirDecisionOf(seq(s)));
  assert.deepEqual([...seen].sort(), ['agent_only', 'inherit', 'refuse']);
  const handover = buildHandover(intake(), NOW, seq(4));
  assert.ok(['inherit', 'refuse', 'agent_only'].includes(handover.theirs));
});

test('約束は期限つきで引き継がれる', () => {
  const handover = buildHandover(intake(), NOW, seq());
  assert.ok(handover.pledges.length >= 1);
  for (const pledge of handover.pledges) {
    assert.ok(pledge.dueDay > 0);
    assert.equal(pledge.status, 'pending');
  }
  assert.equal(handover.tally.plans, handover.pledges.length);
});

test('引き継ぎからの経過は倍率で進む', () => {
  const handover = buildHandover(intake(), NOW, seq());
  assert.equal(daysSinceHandover(handover, NOW), 0);
  assert.equal(daysSinceHandover(handover, new Date('2026-09-03T12:00:00.000Z')), 3);
  assert.equal(daysSinceHandover(handover, new Date('2026-08-31T13:00:00.000Z'), 24), 1);
});
