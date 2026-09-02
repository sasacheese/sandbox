import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateSeed, validateSeed } from './generate-seed.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { parseAll } from './transcript.ts';

const transcript = parseAll(SAMPLE_TRANSCRIPTS).find((t) => t.name === '川口');
assert.ok(transcript);

function raw(over: Record<string, unknown> = {}) {
  return {
    short: '飲み友達',
    relation: '前に何度か飲んだ相手。',
    callsTemplate: '{name}',
    secret: '転職を考えている。',
    avoid: '前の職場の話。',
    joke: { phrase: 'また今度', meaning: '最後の言い方から。' },
    fabrications: ['あなたが毎週飲みに行っていること'],
    plans: [{ body: '飲みに行く。', dueDay: 10 }],
    tally: { messages: 200, secrets: 2, conflicts: 1 },
    asks: [{ id: 'a1', day: 20, gap: '2026/04/27 より後のことは過去ログにありません', text: '最近どうですか', onYes: '変わりません', onNo: '少し変わりました', onGuess: '変わりません' }],
    script: Array.from({ length: 16 }, (_, i) => ({
      day: 2 + i * 5,
      side: i % 2 === 0 ? 'yours' : 'theirs',
      text: `一通目 ${i}`,
      ...(i === 0 ? { source: 'history', from: 'ぜひ。また今度' } : {}),
      ...(i === 2 ? { source: 'history', from: '過去ログに無い文' } : {}),
    })),
    ...over,
  };
}

test('形が揃っていれば台本になり、呼び方の雛形が関数に戻る', () => {
  const seed = validateSeed(raw(), transcript, 'たつや', { at: 0.2, days: 60, gap: 0.01 });
  assert.ok(seed);
  assert.equal(seed.name, '川口');
  assert.equal(seed.generated, true);
  assert.equal(seed.script.length, 16);
  assert.equal(hydrateSeed(seed).callsOf('たつや'), 'たつや');
});

test('履歴に無い文を引いていたら、出どころを「文体」へ落とす', () => {
  const seed = validateSeed(raw(), transcript, 'たつや', undefined);
  assert.ok(seed);
  const grounded = seed.script[0];
  const bogus = seed.script[2];
  assert.equal(grounded?.source, 'history');
  assert.equal(grounded?.from, 'ぜひ。また今度');
  assert.equal(bogus?.source, 'style');
  assert.equal(bogus?.from, undefined);
});

test('短すぎる台本や片側だけの台本は作らない', () => {
  assert.equal(validateSeed(raw({ script: [] }), transcript, 'たつや', undefined), null);
  const oneSided = raw({ script: Array.from({ length: 14 }, (_, i) => ({ day: i + 1, side: 'yours', text: 'x' })) });
  assert.equal(validateSeed(oneSided, transcript, 'たつや', undefined), null);
  assert.equal(validateSeed('ごみ', transcript, 'たつや', undefined), null);
});

test('日付は後戻りしない', () => {
  const seed = validateSeed(raw({ script: [...raw().script, { day: 1, side: 'theirs', text: '戻る' }] }), transcript, 'たつや', undefined);
  assert.ok(seed);
  for (let i = 1; i < seed.script.length; i++) {
    assert.ok((seed.script[i]?.day ?? 0) >= (seed.script[i - 1]?.day ?? 0));
  }
});
