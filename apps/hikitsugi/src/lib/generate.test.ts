import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHandover, companionCount, daysSinceHandover } from './generate.ts';
import { isoTime, type Intake } from './types.ts';

/** 決まった数列を返す乱数。同じ申込から同じ書類が出ることを確かめるため。 */
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
    days: 30,
    watch: true,
    startedAt: isoTime(new Date('2026-08-01T00:00:00.000Z')),
    ...over,
  };
}

const NOW = new Date('2026-08-31T12:00:00.000Z');

test('期間が長いほど関係が増える', () => {
  assert.equal(companionCount(14), 3);
  assert.equal(companionCount(30), 4);
  assert.equal(companionCount(90), 5);
  assert.equal(buildHandover(intake({ days: 14 }), NOW, seq()).companions.length, 3);
  assert.equal(buildHandover(intake({ days: 90 }), NOW, seq()).companions.length, 5);
});

test('同じ申込と同じ乱数からは同じ書類が出る', () => {
  const a = buildHandover(intake(), NOW, seq(7));
  const b = buildHandover(intake(), NOW, seq(7));
  assert.deepEqual(a, b);
});

test('触れられたくない話題が、関係の材料として引継書に載る', () => {
  const handover = buildHandover(intake({ avoid: '実家のこと' }), NOW, seq());
  const leak = handover.leaked.find((line) => line.includes('実家のこと'));
  assert.ok(leak, '申告した話題が漏れの一覧に無い');
  assert.match(leak, /触れられたくない話題として申告/);
});

test('約束は相手ごとに一つずつ、期限つきで付いてくる', () => {
  const handover = buildHandover(intake(), NOW, seq());
  assert.equal(handover.pledges.length, handover.companions.length);
  for (const pledge of handover.pledges) {
    assert.ok(handover.companions.some((c) => c.id === pledge.to));
    assert.ok(pledge.dueDay > 0);
    assert.equal(pledge.status, 'pending');
  }
});

test('作り話と本当のことが同じ欄に混ざる', () => {
  const handover = buildHandover(intake(), NOW, seq(3));
  const first = handover.companions[0];
  assert.ok(first);
  assert.ok(first.beliefs.some((b) => b.fabricated), '作り話が無い');
  assert.ok(first.beliefs.length >= 3);
});

test('親密度は 100 にならない（完成した関係は渡さない）', () => {
  for (let s = 1; s < 30; s++) {
    for (const companion of buildHandover(intake({ days: 90 }), NOW, seq(s)).companions) {
      assert.ok(companion.closeness >= 18 && companion.closeness <= 95, `範囲外: ${companion.closeness}`);
    }
  }
});

test('記録は一日一行で、まだ会っていない相手は出てこない', () => {
  const handover = buildHandover(intake({ days: 30 }), NOW, seq(5));
  assert.equal(handover.log.length, 30);
  const late = handover.companions.filter((c) => c.metDay > 5);
  for (const entry of handover.log.filter((e) => e.day <= 4)) {
    for (const companion of late) assert.ok(!entry.text.includes(companion.name), `${entry.day} 日目に ${companion.name} が出ている`);
  }
});

test('引き継ぎからの経過は倍率をかけると進む', () => {
  const handover = buildHandover(intake(), NOW, seq());
  assert.equal(daysSinceHandover(handover, NOW), 0);
  assert.equal(daysSinceHandover(handover, new Date('2026-09-03T12:00:00.000Z')), 3);
  assert.equal(daysSinceHandover(handover, new Date('2026-08-31T13:00:00.000Z'), 24), 1);
});
