import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrateSeed } from './generate-seed.ts';
import { buildHandover, buildProxyThreads, SOLO_NOTE } from './generate.ts';
import { DEFAULT_LOOP_MS, planOf, slotOf } from './loop.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { callsTemplateOf, SOLO_DAYS, soloSeedOf } from './solo.ts';
import { bubblesOf, postsShown } from './threads.ts';
import { parseAll } from './transcript.ts';
import { isoTime, type Intake } from './types.ts';

const TRANSCRIPTS = parseAll(SAMPLE_TRANSCRIPTS);
const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();
const INTAKE: Intake = { name: 'たつや', persona: 50, startedAt: isoTime(new Date(START)) };

function kawaguchi() {
  const transcript = TRANSCRIPTS.find((t) => t.name === '川口');
  assert.ok(transcript, '見本に川口が居ない');
  return transcript;
}

test('モデルを呼ばず、過去ログだけから片側の代理の台本が出る', () => {
  const seed = soloSeedOf(kawaguchi(), 'たつや', 0.3);
  assert.equal(seed.solo, true);
  assert.equal(seed.name, '川口');
  assert.deepEqual(seed.slot, { at: 0.3, days: SOLO_DAYS, gap: seed.slot?.gap });
  // 日付は単調に増える
  const days = seed.script.map((l) => l.day);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
  // 履歴から引いた一通は、過去ログに実在する
  const quoted = seed.script.filter((l) => l.source === 'history');
  assert.ok(quoted.length >= 1);
  assert.ok(quoted.every((l) => l.from && kawaguchi().messages.some((m) => m.mine && m.text === l.from)));
  // 相手の一通目は、その相手が一度だけ返す言葉
  assert.equal(seed.script.find((l) => l.side === 'theirs')?.text, 'ごめん、通知に埋もれてた。近いうちに。');
});

test('相手があなたを呼ぶ形は、過去ログから拾う', () => {
  assert.equal(callsTemplateOf({ name: 'x', own: null, messages: [{ at: 0, mine: false, text: 'たつやくん元気？' }] }, 'たつや'), '{name}くん');
  assert.equal(callsTemplateOf({ name: 'x', own: null, messages: [{ at: 0, mine: false, text: 'ありがとう' }] }, 'たつや'), '{name}さん');
  assert.equal(hydrateSeed(soloSeedOf(kawaguchi(), 'たつや', 0)).callsOf('たつや').length > 0, true);
});

test('片側の代理のトークでは、相手側は人間の色で、開示に「相手側も同じ」と書かない', () => {
  const seed = hydrateSeed(soloSeedOf(kawaguchi(), 'たつや', 0));
  const slot = slotOf(seed);
  assert.ok(slot);
  const plan = planOf(slot, LOOP, seed);
  assert.ok(plan);
  const threads = buildProxyThreads(new Date(START + plan.endsAt + 1_000), TRANSCRIPTS, START, LOOP, [seed]);
  const thread = threads.find((t) => t.seedId === seed.id);
  assert.ok(thread, '片側の代理のトークが出ていない');
  const now = new Date(START + plan.endsAt + 1_000);
  assert.equal(postsShown(thread, now), thread.posts);
  const bubbles = bubblesOf(thread, now);
  const system = bubbles.find((b) => b.system);
  assert.ok(system?.system && !system.system.includes('相手側も同じ'));
  const left = bubbles.filter((b) => b.side === 'left' && !b.system);
  assert.ok(left.length >= 3);
  assert.ok(left.every((b) => b.byAgent === false), '相手側が代理の色になっている');
  assert.ok(bubbles.filter((b) => b.side === 'right' && !b.ask).every((b) => b.byAgent));
});

test('引継書には、相手が代理と話していたことを知らないと載る', () => {
  const seed = hydrateSeed(soloSeedOf(kawaguchi(), 'たつや', 0));
  const slot = slotOf(seed);
  assert.ok(slot);
  const plan = planOf(slot, LOOP, seed);
  assert.ok(plan);
  const now = new Date(START + plan.endsAt + 1_000);
  const thread = buildProxyThreads(now, TRANSCRIPTS, START, LOOP, [seed]).find((t) => t.seedId === seed.id);
  assert.ok(thread);
  const sheet = buildHandover(thread, INTAKE, TRANSCRIPTS, now);
  assert.ok(sheet);
  assert.equal(sheet.solo, true);
  assert.equal(sheet.notes[0], SOLO_NOTE);
  assert.ok(sheet.notes[0]?.includes('知りません'));
  // 相手側に判断は無い。人間がそのまま続ける
  assert.equal(sheet.theirs, 'inherit');
});
