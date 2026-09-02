import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findName, interpret, replyFor } from './agent.ts';
import { buildProxyThread } from './generate.ts';
import { DEFAULT_LOOP_MS, plans } from './loop.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { isHeld, isLive, postsShown } from './threads.ts';
import { parseAll } from './transcript.ts';
import { isoTime } from './types.ts';

const NAMES = ['菅野 千夏', '小松 遼', '川口', 'さやか'];

test('姓だけ・名だけ・敬称つきでも相手を見つける', () => {
  assert.equal(findName('菅野さんには返さないで', NAMES), '菅野 千夏');
  assert.equal(findName('千夏とはもう話さないで', NAMES), '菅野 千夏');
  assert.equal(findName('川口は再開していい', NAMES), '川口');
  assert.equal(findName('丁寧語をやめて', NAMES), undefined);
});

test('止める・再開する・申し送る、の三つに読み分ける', () => {
  assert.deepEqual(interpret('菅野さんには返信しないで', NAMES), { kind: 'mute', target: '菅野 千夏' });
  assert.deepEqual(interpret('小松とはしばらく話さないで', NAMES), { kind: 'mute', target: '小松 遼' });
  assert.deepEqual(interpret('菅野さんとの話、再開していいよ', NAMES), { kind: 'unmute', target: '菅野 千夏' });
  // 話題を避ける指示は、止めるのではなく申し送りとして相手に紐づく
  assert.deepEqual(interpret('川口には実家の話をしないで', NAMES), { kind: 'note', target: '川口' });
  assert.deepEqual(interpret('全員に、敬語は使わないで', NAMES), { kind: 'note' });
});

test('代理の返事は、何を理解したかを言い直す', () => {
  const at = isoTime(new Date());
  const mute = replyFor({ id: 'r', at, text: '菅野さんには返さないで', kind: 'mute', target: '菅野 千夏' }, []);
  assert.match(mute, /菅野 千夏 さんとのやり取りを止めます/);
  const note = replyFor({ id: 'r', at, text: '敬語をやめて', kind: 'note' }, ['a', 'b']);
  assert.match(note, /2 人/);
  assert.match(note, /敬語をやめて/);
});

test('止めると時計が止まり、再開しても飛ばない', () => {
  const transcripts = parseAll(SAMPLE_TRANSCRIPTS);
  const plan = plans(DEFAULT_LOOP_MS).find((p) => p.slot.seedId === 'toda');
  assert.ok(plan);
  const start = new Date('2026-09-01T00:00:00.000Z').getTime();
  const history = transcripts.find((t) => t.name === plan.seed.name)?.messages ?? [];
  const at = start + plan.appearsAt;
  const gap = plan.gapMs;

  const running = buildProxyThread(plan, 0, start, history);
  assert.equal(postsShown(running, new Date(at + 5 * gap)), 5);

  // 5 通目のあとで止める。10 通ぶんの時間が過ぎても 5 のまま
  const held = buildProxyThread(plan, 0, start, history, { since: at + 5 * gap, total: 0 });
  assert.equal(postsShown(held, new Date(at + 15 * gap)), 5);
  assert.equal(isHeld(held), true);
  assert.equal(isLive(held, new Date(at + 15 * gap)), false);

  // 10 通ぶん止めてから再開。飛ばずに 6 通目が届く
  const resumed = buildProxyThread(plan, 0, start, history, { since: null, total: 10 * gap });
  assert.equal(postsShown(resumed, new Date(at + 15 * gap)), 5);
  assert.equal(postsShown(resumed, new Date(at + 16 * gap)), 6);
  assert.equal(isLive(resumed, new Date(at + 16 * gap)), true);
});
