import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatheringWhen, hueOf, initial, since } from './format.ts';

test('経過は粒度を段で落とす', () => {
  const now = new Date('2026-08-30T12:00:00+09:00');
  assert.equal(since('2026-08-30T11:59:30+09:00', now), 'たった今');
  assert.equal(since('2026-08-30T11:20:00+09:00', now), '40分前');
  assert.equal(since('2026-08-30T09:00:00+09:00', now), '3時間前');
  assert.equal(since('2026-08-29T09:00:00+09:00', now), '昨日');
  assert.equal(since('2026-08-27T09:00:00+09:00', now), '3日前');
  assert.equal(since('壊れた値', now), '');
});

test('集まりの日時は曜日まで出す', () => {
  assert.match(gatheringWhen('2026-08-30T21:00:00+09:00'), /8\/30.*21:00/);
  assert.equal(gatheringWhen('x'), '');
});

test('同じ名前は必ず同じ色になる', () => {
  assert.equal(hueOf('みなと'), hueOf('みなと'));
  assert.notEqual(hueOf('みなと'), hueOf('K.'));
  assert.ok(hueOf('まる') >= 0 && hueOf('まる') < 360);
});

test('頭文字は絵文字でも 1 文字で取れる', () => {
  assert.equal(initial(' みなと '), 'み');
  assert.equal(initial(''), '?');
});
