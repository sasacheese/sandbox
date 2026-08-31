import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messages, questions, reports } from './after.ts';
import { buildHandover } from './generate.ts';
import { isoTime, type Handover, type Intake, type TheirDecision } from './types.ts';

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
  persona: 50,
  startedAt: isoTime(new Date('2026-06-01T00:00:00.000Z')),
};

const base = buildHandover(intake, new Date('2026-08-31T12:00:00.000Z'), seq(2));
const withTheirs = (theirs: TheirDecision): Handover => ({ ...base, theirs });

test('確認は三問で、答えは引継書の中にある', () => {
  const list = questions(base, seq(4));
  assert.equal(list.length, 3);
  for (const q of list) {
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4, '選択肢が重複している');
    const correct = q.choices[q.answer];
    assert.ok(
      [base.counterpart.secret, base.counterpart.joke.meaning, base.counterpart.avoid].includes(correct ?? ''),
      `引継書に無い答え: ${correct}`,
    );
  }
});

test('引き継がなければ連絡は来ない', () => {
  assert.deepEqual(messages(withTheirs('inherit'), 'agent_only'), []);
  assert.deepEqual(messages(withTheirs('inherit'), 'end'), []);
});

test('相手が拒否した場合も連絡は来ない', () => {
  assert.deepEqual(messages(withTheirs('refuse'), 'inherit'), []);
});

test('相手が代理人に任せた場合、すべての連絡が代理人からになる', () => {
  const list = messages(withTheirs('agent_only'), 'inherit');
  assert.ok(list.length > 0);
  assert.ok(list.every((m) => m.byAgent));
});

test('双方が引き継いだ場合、連絡は人間から来る', () => {
  const list = messages(withTheirs('inherit'), 'inherit');
  assert.ok(list.length > 0);
  assert.ok(list.every((m) => !m.byAgent));
});

test('内輪の言い回しだけを送ってくる連絡がある', () => {
  const list = messages(withTheirs('inherit'), 'inherit');
  const joke = list.find((m) => m.id === 'm-joke');
  assert.ok(joke);
  assert.ok(joke.body.includes(base.counterpart.joke.phrase));
  assert.equal(joke.questionId, 'q-joke');
});

test('連絡は日付順で、催促は期限より前に来る', () => {
  const list = messages(withTheirs('inherit'), 'inherit');
  assert.deepEqual(list.map((m) => m.day), [...list].map((m) => m.day).sort((a, b) => a - b));
  for (const pledge of base.pledges) {
    const reminder = list.find((m) => m.id === `m-pledge-${pledge.id}`);
    assert.ok(reminder);
    assert.ok(reminder.day < pledge.dueDay);
  }
});

test('週報は一週ごとに一件増え、新しい順に並ぶ', () => {
  assert.deepEqual(reports(6), []);
  assert.equal(reports(7).length, 1);
  const three = reports(21);
  assert.equal(three.length, 3);
  assert.deepEqual(three.map((r) => r.week), [3, 2, 1]);
});
