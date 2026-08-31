import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byQuiet, digestOf, ownNameOf, parseAll, parseTranscript } from './transcript.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';

const NOW = new Date('2026-09-01T00:00:00.000Z');

test('書き出しを読むと、相手・自分・やり取りが出る', () => {
  const parsed = parseTranscript(`[LINE] 川口とのトーク履歴
保存日時：2026/09/01 02:15

2026/04/26(日)
21:02\t川口\t久しぶり。元気にしてる？
21:42\tたつや\tおかげさまで。そっちは？
`);
  assert.ok(parsed);
  assert.equal(parsed.name, '川口');
  // 自分の名前は書式から分からないので、相手ではないほうを自分とみなす
  assert.equal(parsed.own, 'たつや');
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[0]?.mine, false);
  assert.equal(parsed.messages[1]?.mine, true);
  assert.equal(parsed.messages[0]?.text, '久しぶり。元気にしてる？');
});

test('日付の書式が違っても読む', () => {
  const dotted = parseTranscript(`[LINE] 宮田とのトーク履歴

2024.10.11 金曜日
18:30\t宮田\tありがとうございました
18:40\t自分\tこちらこそ
`);
  assert.ok(dotted, '点区切りの日付が読めていない');
  assert.equal(dotted.messages.length, 2);
});

test('スタンプや写真は落とす', () => {
  const parsed = parseTranscript(`[LINE] さやかとのトーク履歴

2025/07/26(土)
13:20\tさやか\t結婚しました
13:22\tさやか\t写真
13:23\tさやか\t[スタンプ]
14:50\tたつや\tおめでとう！
`);
  assert.ok(parsed);
  // 書き出しには項目名しか残らないので、会話としては読めない
  assert.equal(parsed.messages.length, 2);
  assert.ok(parsed.messages.every((m) => m.text !== '写真'));
});

test('複数行の発言は前の一通へ足す', () => {
  const parsed = parseTranscript(`[LINE] 川口とのトーク履歴

2026/04/26(日)
21:02\t川口\t久しぶり。
元気にしてる？
21:42\tたつや\tうん
`);
  assert.ok(parsed);
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[0]?.text, '久しぶり。\n元気にしてる？');
});

test('読めないものは捨てる。取り込みごと失敗させない', () => {
  assert.equal(parseTranscript('ただのメモ'), null);
  assert.equal(parseTranscript('[LINE] 誰かとのトーク履歴\n\n中身なし'), null);
  const some = parseAll(['ごみ', SAMPLE_TRANSCRIPTS[0] ?? '']);
  assert.equal(some.length, 1);
});

test('集計だけで、静かな期間と通数が出る', () => {
  const parsed = parseTranscript(SAMPLE_TRANSCRIPTS[0] ?? '');
  assert.ok(parsed);
  const digest = digestOf(parsed, NOW);
  assert.ok(digest);
  assert.equal(digest.name, '菅野 千夏');
  assert.ok(digest.count >= 4);
  assert.ok(digest.mineCount > 0 && digest.mineCount < digest.count);
  // 三年以上前で止まっている
  assert.ok(digest.quietDays > 365 * 3, `${digest.quietDays} 日`);
  assert.ok(digest.lastAt > digest.firstAt);
});

test('同梱の履歴は十二件そろっていて、全部止まっている', () => {
  const all = parseAll(SAMPLE_TRANSCRIPTS);
  assert.equal(all.length, 12);
  assert.equal(ownNameOf(all), 'たつや');
  const digests = all.map((t) => digestOf(t, NOW)).filter((d) => d !== null);
  assert.equal(digests.length, 12);
  // いちばん新しいものでも三か月以上前
  assert.ok(Math.min(...digests.map((d) => d.quietDays)) > 90);
  // 静かな順に並べると、いちばん上が十年もの
  const sorted = [...digests].sort(byQuiet);
  assert.ok((sorted[0]?.quietDays ?? 0) > 365 * 10);
  assert.equal(sorted[0]?.name, '戸田 亮');
});

test('最後の一通は、どれも約束になっていない', () => {
  const digests = parseAll(SAMPLE_TRANSCRIPTS)
    .map((t) => digestOf(t, NOW))
    .filter((d) => d !== null);
  // 日付が入った約束が一つもない、という前提の上に作品が乗っている
  assert.ok(digests.every((d) => !/月\d|日に|時に/.test(d.lastText)));
});
