import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moodNow, moodTier, shiftMood } from './mood.ts';
import type { IsoTime, Realm } from './types.ts';

function realm(over: Partial<Realm> = {}): Realm {
  return {
    name: '第七区',
    laws: [],
    accent: '#c8452e',
    mood: 60,
    moodAt: '2026-08-01T00:00:00.000Z' as IsoTime,
    silenced: [],
    stopped: false,
    ...over,
  };
}

test('機嫌は経過時間ぶん減る', () => {
  assert.equal(moodNow(realm(), new Date('2026-08-01T00:00:00.000Z')), 60);
  assert.equal(moodNow(realm(), new Date('2026-08-01T10:00:00.000Z')), 50);
  // 底で止まる
  assert.equal(moodNow(realm(), new Date('2026-08-10T00:00:00.000Z')), 0);
});

test('倍率をかけると早く減る', () => {
  assert.equal(moodNow(realm(), new Date('2026-08-01T00:10:00.000Z'), 60), 50);
});

test('過去の時刻を渡しても増えない', () => {
  assert.equal(moodNow(realm(), new Date('2026-07-01T00:00:00.000Z')), 60);
});

test('増減は現在値を確定させてから行う', () => {
  const next = shiftMood(realm(), 14, new Date('2026-08-01T10:00:00.000Z'));
  assert.equal(next.mood, 64); // 60 → 減衰で 50 → +14
  assert.equal(next.moodAt, '2026-08-01T10:00:00.000Z');
  assert.equal(moodNow(next, new Date('2026-08-01T10:00:00.000Z')), 64);
});

test('上限と下限を超えない', () => {
  assert.equal(shiftMood(realm({ mood: 95 }), 20, new Date('2026-08-01T00:00:00.000Z')).mood, 100);
  assert.equal(shiftMood(realm({ mood: 5 }), -20, new Date('2026-08-01T00:00:00.000Z')).mood, 0);
});

test('段はしきい値で切り替わる', () => {
  assert.equal(moodTier(100), 'high');
  assert.equal(moodTier(70), 'high');
  assert.equal(moodTier(69), 'mid');
  assert.equal(moodTier(40), 'mid');
  assert.equal(moodTier(39), 'low');
  assert.equal(moodTier(12), 'low');
  assert.equal(moodTier(11), 'dying');
});
