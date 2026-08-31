import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proxyShare, yourScale } from './timeline.ts';

test('引き継ぎ直後は代理人の区間が大きい', () => {
  assert.equal(proxyShare(0, 21), 0.68);
  assert.equal(proxyShare(21, 21), 0.68);
});

test('約束の期限を越えたら、あなたの区間へ幅を譲る', () => {
  assert.ok(proxyShare(42, 21) < 0.68);
  assert.ok(proxyShare(200, 21) < proxyShare(42, 21));
});

test('代理人の区間が消えるところまでは譲らない', () => {
  assert.ok(proxyShare(100000, 21) >= 0.3);
});

test('目盛りは経過が期限を越えたら経過に合わせる', () => {
  assert.equal(yourScale(3, 21), 21);
  assert.equal(yourScale(40, 21), 40);
  assert.equal(yourScale(0, 0), 1);
});
