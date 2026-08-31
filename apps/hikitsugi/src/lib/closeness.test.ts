import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECAY_PER_DAY, effectiveCloseness, inheritedCloseness } from './closeness.ts';

test('引き継いだ直後は代行が築いた値のまま', () => {
  assert.equal(effectiveCloseness(62, 0, 0), 62);
  assert.equal(inheritedCloseness(62), 62);
});

test('放置すると下がる', () => {
  assert.equal(effectiveCloseness(62, 0, 10), Math.round(62 - 10 * DECAY_PER_DAY));
  assert.ok(effectiveCloseness(62, 0, 30) < effectiveCloseness(62, 0, 10));
});

test('応答は加算され、放置ぶんと打ち消し合う', () => {
  assert.equal(effectiveCloseness(50, -14, 0), 36);
  assert.equal(effectiveCloseness(50, 6, 10), 50);
});

test('0 と 100 を越えない', () => {
  assert.equal(effectiveCloseness(10, -40, 5), 0);
  assert.equal(effectiveCloseness(95, 20, 0), 100);
  assert.equal(effectiveCloseness(20, 0, 1000), 0);
});
