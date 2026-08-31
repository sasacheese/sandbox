import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOOP_MS, LOOP_PRESETS, SLOTS, loopAt, plans, plansAt, postCount, scaleDay, seedOf } from './loop.ts';

const LOOP = DEFAULT_LOOP_MS;

test('九本ぶんが一巡のなかに収まる', () => {
  const list = plans(LOOP);
  assert.equal(list.length, SLOTS.length);
  assert.equal(list.length, 9);
  // 出し切る前に頭へ戻ってしまうと、満了しないトークが残る
  for (const plan of list) {
    assert.ok(plan.endsAt <= LOOP, `${plan.seed.name} が一巡に収まっていない`);
  }
  // 逆に、早く終わりすぎると最後が静かになる
  assert.ok(Math.max(...list.map((p) => p.endsAt)) > LOOP * 0.9);
});

test('トークは順に現れる。放っておくと増える', () => {
  const head = plansAt(0, LOOP);
  const middle = plansAt(LOOP * 0.5, LOOP);
  const end = plansAt(LOOP * 0.99, LOOP);
  assert.ok(head.length >= 2, '最初から何本かは動いている');
  assert.ok(middle.length > head.length, '増えていない');
  assert.equal(end.length, 9, '最後には全部が出ている');
});

test('一本は満了済みで始まる。開いた瞬間に引き継げるものがある', () => {
  const first = plansAt(0, LOOP);
  assert.ok(first.some((plan) => plan.slot.head >= 1));
  assert.ok(first.some((plan) => plan.slot.head < 1), '途中のものも並んでいる');
});

test('つねに二本前後が同時に動いている', () => {
  const list = plans(LOOP);
  const live = (phase: number) => list.filter((p) => p.appearsAt <= phase && p.endsAt > phase).length;
  let sum = 0;
  let busy = 0;
  for (let i = 0; i < 100; i++) {
    const count = live((i / 100) * LOOP);
    sum += count;
    if (count >= 2) busy++;
  }
  // 一本ずつ順番に流すと画面が静かになる
  assert.ok(sum / 100 >= 2, `同時に動いているのは平均 ${(sum / 100).toFixed(2)} 本`);
  assert.ok(busy >= 70, `二本以上が動いているのは ${busy}%`);
});

test('画面全体では十秒ほどに一通が届く', () => {
  const posts = plans(LOOP).reduce((n, plan) => n + plan.posts, 0);
  const perPost = LOOP / 1000 / posts;
  assert.ok(perPost < 12, `${perPost.toFixed(1)} 秒に一通では静かすぎる`);
});

test('投稿の間隔は十数秒。かつトークごとにずれている', () => {
  const gaps = plans(LOOP).map((plan) => Math.round(plan.gapMs / 1000));
  for (const gap of gaps) {
    assert.ok(gap >= 12 && gap <= 22, `${gap} 秒は速すぎるか遅すぎる`);
  }
  // 揃うと一斉に届いて機械らしさが増しすぎる（画面も静かになる）
  assert.ok(new Set(gaps).size >= 5, '間隔が揃いすぎている');
});

test('一巡の長さを変えても、現れる順と本数は変わらない', () => {
  for (const preset of LOOP_PRESETS) {
    const list = plans(preset.ms);
    assert.deepEqual(
      list.map((p) => p.seed.id),
      plans(LOOP).map((p) => p.seed.id),
    );
    for (const plan of list) assert.ok(plan.endsAt <= preset.ms);
  }
  // 長くすると間隔だけが伸びる
  const short = plans(LOOP)[3];
  const long = plans(60 * 60_000)[3];
  assert.ok(short && long);
  assert.ok(long.gapMs > short.gapMs);
});

test('出し切ると最初へ戻る', () => {
  const start = new Date('2026-09-01T00:00:00.000Z').getTime();
  const first = loopAt(new Date(start + LOOP * 0.5), start, LOOP);
  const second = loopAt(new Date(start + LOOP * 1.5), start, LOOP);
  assert.equal(first.index, 0);
  assert.equal(second.index, 1);
  assert.equal(second.phase, first.phase);
  // 頭へ戻ると本数も戻る
  assert.ok(plansAt(second.phase, LOOP).length < 9);
});

test('台本の日付は、そのトークの期間へ縮む', () => {
  assert.equal(scaleDay(90, 90), 90);
  assert.equal(scaleDay(90, 30), 30);
  assert.equal(scaleDay(45, 30), 15);
  // 0 日目は作らない
  assert.equal(scaleDay(1, 30), 1);
});

test('残りの投稿数は、進んでいたぶんを差し引いて数える', () => {
  const seed = seedOf('sugano');
  assert.ok(seed);
  const all = postCount(seed, 90);
  assert.ok(all > 20);
  assert.ok(postCount(seed, 90, 45) < all, '途中から数えても減っていない');
  assert.equal(postCount(seed, 90, 90), 0, '満了後に残っている');
  // 確認は「札」と「代理人の応答」の二通ぶん
  assert.equal(all, seed.script.length + seed.asks.length * 2);
});
