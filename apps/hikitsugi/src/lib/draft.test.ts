import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftFor, shapeTo, splitSentences } from './draft.ts';
import { buildProxyThread, withState } from './generate.ts';
import { DEFAULT_LOOP_MS, plans } from './loop.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { bubblesOf } from './threads.ts';
import { parseAll, toneOf, type Tone } from './transcript.ts';
import { isoTime, type Thread } from './types.ts';

const TRANSCRIPTS = parseAll(SAMPLE_TRANSCRIPTS);
const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();

/** 出し切って、引き継いだ直後の菅野さん。 */
function inherited(at: Date, sent: Thread['sent'] = []): Thread {
  const plan = plans(LOOP).find((p) => p.slot.seedId === 'sugano');
  assert.ok(plan);
  const history = TRANSCRIPTS.find((t) => t.name === plan.seed.name)?.messages ?? [];
  const thread = buildProxyThread(plan, 0, START, history);
  return withState(thread, { sent, answers: {}, delta: 0, decision: 'inherit', inheritedAt: isoTime(at) });
}

const PERIOD: Tone = { replyMinutes: 38, lateShare: 0, avgLength: 30, period: true };
const NO_PERIOD: Tone = { replyMinutes: 38, lateShare: 0, avgLength: 30, period: false };
const SHORT: Tone = { replyMinutes: 38, lateShare: 0, avgLength: 8, period: false };

test('句点を打たない人には、句点を落として改行で切る', () => {
  assert.equal(shapeTo(['はい。', 'お待たせしました。'], PERIOD), 'はい。お待たせしました。');
  assert.equal(shapeTo(['はい。', 'お待たせしました。'], NO_PERIOD), 'はい\nお待たせしました');
});

test('一通が短い人には、最初の一文だけ', () => {
  assert.equal(shapeTo(['はい。', 'お待たせしました。'], SHORT), 'はい');
});

test('「。」で文を切る', () => {
  assert.deepEqual(splitSentences('その話、覚えています。急がなくていいです。'), ['その話、覚えています。', '急がなくていいです。']);
});

test('引き継いでいないトークには下書きが無い', () => {
  const plan = plans(LOOP).find((p) => p.slot.seedId === 'sugano');
  assert.ok(plan);
  const thread = buildProxyThread(plan, 0, START, []);
  assert.equal(draftFor(thread, bubblesOf(thread, new Date(START)), PERIOD), null);
});

test('相手の一通に応じた下書きが出て、返したら次の言葉に変わる', () => {
  const at = new Date(START + 60_000);
  const thread = inherited(at);
  // 引き継いだ直後、相手から「やっと本人と話せますね」が届いている
  const bubbles = bubblesOf(thread, new Date(at.getTime() + 1_000));
  assert.ok(bubbles.at(-1)?.side === 'left');
  const first = draftFor(thread, bubbles, PERIOD);
  assert.equal(first, 'はい。お待たせしました。');

  // 返したあとは、続けて言うことが出る（同じ文は繰り返さない）
  const replied = inherited(at, [{ id: 'me-1', at: isoTime(new Date(at.getTime() + 2_000)), text: first ?? '', byAgent: false, draft: true }]);
  const next = draftFor(replied, bubblesOf(replied, new Date(at.getTime() + 3_000)), PERIOD);
  assert.ok(next && next !== first);
});

test('内輪の言い回しが来たら、同じ言葉で返す', () => {
  const at = new Date(START + 60_000);
  const thread = inherited(at);
  // 一通目の翌「日」（一通ぶん）に、内輪の言い回しが届く
  const later = new Date(at.getTime() + thread.gapMs + 1_000);
  const bubbles = bubblesOf(thread, later);
  const last = bubbles.at(-1);
  assert.ok(last?.side === 'left' && last.text.startsWith('三分の一'));
  assert.equal(draftFor(thread, bubbles, PERIOD), '三分の一。覚えています。');
});

test('過去ログから読んだ書き方で形が変わる', () => {
  const transcript = TRANSCRIPTS.find((t) => t.name === '菅野 千夏');
  assert.ok(transcript);
  const tone = toneOf(transcript);
  assert.ok(tone);
  const at = new Date(START + 60_000);
  const thread = inherited(at);
  const text = draftFor(thread, bubblesOf(thread, new Date(at.getTime() + 1_000)), tone);
  assert.ok(text);
  // 句点を打つ人なら「。」で終わり、打たない人なら「。」が無い
  assert.equal(/[。]/.test(text), tone.period);
});
