import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONDITIONS, makeDecree, makeDirective, makeVerdict, nextActions } from './operator.ts';
import type { Directive, DirectiveId, IsoTime, Realm } from './types.ts';

/** 決まった数列を返す乱数。生成の分岐を固定して確かめるため。 */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

function realm(over: Partial<Realm> = {}): Realm {
  return {
    name: '第七区',
    laws: ['指令の理由を問わないこと'],
    accent: '#c8452e',
    mood: 50,
    moodAt: '2026-08-01T00:00:00.000Z' as IsoTime,
    silenced: [],
    stopped: false,
    ...over,
  };
}

function directive(over: Partial<Directive> = {}): Directive {
  return {
    id: 'd1' as DirectiveId,
    issuedAt: '2026-08-01T00:00:00.000Z' as IsoTime,
    gatherAt: '2026-08-01T01:00:00.000Z' as IsoTime,
    place: '中野四丁目の公園',
    minPeople: 3,
    condition: CONDITIONS[0] ?? '',
    status: 'open',
    attending: false,
    attendees: [],
    ...over,
  };
}

test('指令は登録された場所からしか選ばれない', () => {
  const places = ['公園', 'コンビニの前'];
  for (let i = 0; i < 20; i++) {
    const d = makeDirective(places, seq([i / 20, (i * 7) % 20 / 20, (i * 3) % 20 / 20, (i * 11) % 20 / 20]));
    assert.ok(places.includes(d.place));
    assert.ok(d.minPeople >= 2 && d.minPeople <= 4);
    assert.ok(CONDITIONS.includes(d.condition));
  }
});

test('場所が無ければ運営は前回と同じ場所を指す', () => {
  assert.equal(makeDirective([], seq([0.5])).place, '前回と同じ場所');
});

test('写真が無いときは写真に触れた言葉を返さない', () => {
  for (let i = 0; i < 40; i++) {
    const verdict = makeVerdict(5, 3, seq([0.5, i / 40]));
    assert.ok(!verdict.text.includes('写真'));
  }
});

test('数が足りていても却下されることがある', () => {
  assert.equal(makeVerdict(5, 3, seq([0.1])).accepted, false);
  assert.equal(makeVerdict(5, 3, seq([0.5])).accepted, true);
});

test('数が足りなくても受理されることがある', () => {
  assert.equal(makeVerdict(1, 3, seq([0.9])).accepted, true);
  assert.equal(makeVerdict(1, 3, seq([0.5])).accepted, false);
});

test('布告は同じ名前や同じ色を選び直さない', () => {
  for (let i = 0; i < 30; i++) {
    const draft = makeDecree(realm(), seq([i / 30, ((i * 13) % 30) / 30, ((i * 7) % 30) / 30]));
    if (draft.kind === 'rename') assert.notEqual(draft.value, '第七区');
    if (draft.kind === 'accent') assert.notEqual(draft.value, '#c8452e');
    if (draft.kind === 'law_add') assert.ok(!realm().laws.includes(draft.value));
  }
});

test('報告の無い指令は猶予を過ぎると取りこぼしになる', () => {
  const state = { realm: realm(), directives: [directive()], lastDecreeAt: '2026-08-01T00:00:00.000Z' };
  const soon = nextActions(state, new Date('2026-08-01T02:00:00.000Z'));
  assert.deepEqual(soon.map((a) => a.kind), []);
  const late = nextActions(state, new Date('2026-08-01T04:30:00.000Z'));
  assert.ok(late.some((a) => a.kind === 'miss'));
});

test('開いている指令があるうちは次の指令を出さない', () => {
  const state = { realm: realm(), directives: [directive()], lastDecreeAt: '2026-08-01T00:00:00.000Z' };
  const actions = nextActions(state, new Date('2026-08-01T03:30:00.000Z'));
  assert.ok(!actions.some((a) => a.kind === 'issue'));
});

test('片付いていれば間隔を空けて次の指令が出る', () => {
  const state = {
    realm: realm(),
    directives: [directive({ status: 'accepted' })],
    lastDecreeAt: '2026-08-01T00:00:00.000Z',
  };
  assert.ok(!nextActions(state, new Date('2026-08-01T02:00:00.000Z')).some((a) => a.kind === 'issue'));
  assert.ok(nextActions(state, new Date('2026-08-01T03:30:00.000Z')).some((a) => a.kind === 'issue'));
});

test('倍率をかけると運営は早く動く', () => {
  const state = { realm: realm(), directives: [], lastDecreeAt: '2026-08-01T00:00:00.000Z' };
  assert.ok(nextActions(state, new Date('2026-08-01T00:04:00.000Z'), 60).some((a) => a.kind === 'issue'));
});

test('停止要求は即座には効かず、その間も運営は動く', () => {
  const requested = realm({ stopRequestedAt: '2026-08-01T00:00:00.000Z' as IsoTime });
  const state = { realm: requested, directives: [], lastDecreeAt: null };
  const during = nextActions(state, new Date('2026-08-01T05:00:00.000Z'));
  assert.ok(during.some((a) => a.kind === 'issue'));
  assert.ok(!during.some((a) => a.kind === 'stop'));
  const after = nextActions(state, new Date('2026-08-02T01:00:00.000Z'));
  assert.deepEqual(after, [{ kind: 'stop' }]);
});

test('停止したあとの運営は何もしない', () => {
  const state = { realm: realm({ stopped: true }), directives: [], lastDecreeAt: null };
  assert.deepEqual(nextActions(state, new Date('2026-09-01T00:00:00.000Z')), []);
});
