import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messages, questions } from './after.ts';
import { buildHandover } from './generate.ts';
import { isoTime, type Intake } from './types.ts';

function seq(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const intake: Intake = {
  name: 'たつや',
  interest: '深夜のコインランドリー',
  habit: '本の角を折る',
  avoid: '実家のこと',
  days: 90,
  watch: true,
  startedAt: isoTime(new Date('2026-06-01T00:00:00.000Z')),
};

const handover = buildHandover(intake, new Date('2026-08-31T12:00:00.000Z'), seq(2));

test('確認は相手ごとに一問、答えは選択肢の中にある', () => {
  const list = questions(handover, seq(4));
  assert.equal(list.length, handover.companions.length);
  for (const q of list) {
    assert.equal(q.choices.length, 4, '選択肢が 4 つ揃っていない');
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.equal(new Set(q.choices).size, q.choices.length, '選択肢が重複している');
  }
});

test('確認の答えは引継書の中にある', () => {
  for (const q of questions(handover, seq(9))) {
    const companion = handover.companions.find((c) => c.id === q.companionId);
    assert.ok(companion);
    const correct = q.choices[q.answer];
    assert.ok(
      [companion.secret, companion.joke.meaning, companion.avoid, companion.calls].includes(correct ?? ''),
      `引継書に無い答え: ${correct}`,
    );
  }
});

test('連絡は日をずらして届き、確認つきのものが混ざる', () => {
  const list = messages(handover, seq(6));
  assert.ok(list.length >= handover.companions.length * 2);
  assert.deepEqual([...list].sort((a, b) => a.day - b.day).map((m) => m.day), list.map((m) => m.day));
  assert.ok(list.some((m) => m.questionId));
  assert.ok(list.every((m) => handover.companions.some((c) => c.id === m.from)));
});

test('催促は期限より前に来る', () => {
  const list = messages(handover, seq(6));
  for (const pledge of handover.pledges) {
    const reminder = list.find((m) => m.id === `m-pledge-${pledge.id}`);
    assert.ok(reminder, `催促が無い: ${pledge.id}`);
    assert.ok(reminder.day < pledge.dueDay, '催促が期限より後に来ている');
  }
});
