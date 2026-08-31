import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHandover,
  buildPlainThreads,
  buildProxyThread,
  buildProxyThreads,
  buildThreads,
  fabricationCount,
  seeded,
  theirDecisionOf,
  withState,
} from './generate.ts';
import { DEFAULT_LOOP_MS, plans } from './loop.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { parseAll } from './transcript.ts';
import { isoTime, type Intake, type Thread } from './types.ts';

const TRANSCRIPTS = parseAll(SAMPLE_TRANSCRIPTS);

function historyOf(name: string) {
  return TRANSCRIPTS.find((t) => t.name === name)?.messages ?? [];
}

const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();
const NOW = new Date(START);

function intake(over: Partial<Intake> = {}): Intake {
  return { name: 'たつや', persona: 50, startedAt: isoTime(new Date('2026-08-01T00:00:00.000Z')), ...over };
}

function first(): Thread {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  return buildProxyThread(plan, 0, START, historyOf(plan.seed.name));
}

function handover(thread: Thread, over: Partial<Intake> = {}) {
  return buildHandover(thread, intake(over), TRANSCRIPTS, NOW);
}

test('最初から何本か動いていて、一本は満了している', () => {
  const threads = buildProxyThreads(NOW, TRANSCRIPTS, START, LOOP);
  assert.ok(threads.length >= 2);
  const progress = threads.map((t) => t.headStart / (t.days ?? 1));
  assert.ok(progress.includes(1), '引き継げるものが一本も無い');
  assert.ok(progress.some((p) => p > 0 && p < 1), '途中のものが無い');
  // 名前は伏せない
  assert.ok(threads.every((t) => t.title.length > 1));
});

test('眺めているあいだにトークが増える', () => {
  const head = buildProxyThreads(NOW, TRANSCRIPTS, START, LOOP).length;
  const middle = buildProxyThreads(new Date(START + LOOP * 0.5), TRANSCRIPTS, START, LOOP).length;
  const end = buildProxyThreads(new Date(START + LOOP * 0.99), TRANSCRIPTS, START, LOOP).length;
  assert.ok(middle > head);
  assert.equal(end, 9);
  // 出し切ると頭へ戻る
  assert.equal(buildProxyThreads(new Date(START + LOOP), TRANSCRIPTS, START, LOOP).length, head);
});

test('トークごとに間隔と通数が割り当てられている', () => {
  const threads = buildProxyThreads(new Date(START + LOOP * 0.99), TRANSCRIPTS, START, LOOP);
  assert.ok(threads.every((t) => t.gapMs > 0));
  assert.ok(new Set(threads.map((t) => t.gapMs)).size >= 5);
  // 満了済みの一本以外は、これから届くぶんを持っている
  assert.ok(threads.filter((t) => t.posts > 0).length >= 8);
});

test('自分のトークは止まったもので、既読で始まる', () => {
  const plain = buildPlainThreads(TRANSCRIPTS, START);
  assert.ok(plain.length >= 2);
  assert.ok(plain.every((t) => t.kind === 'plain' && t.sent.length === 0));
  // 自分の過去のやり取りに未読が付くのはおかしい
  assert.ok(plain.every((t) => t.readAt !== undefined));
});

test('一覧は代理人のトークと自分のトークの両方を含む', () => {
  const threads = buildThreads(NOW, TRANSCRIPTS, START, LOOP);
  assert.ok(threads.some((t) => t.kind === 'proxy'));
  assert.ok(threads.some((t) => t.kind === 'plain'));
  // 相手の名前は最初から出ている
  assert.ok(threads.filter((t) => t.kind === 'proxy').every((t) => t.title.length > 1));
});

test('相手側の判断は三通りあり、トークごとに決まっている', () => {
  const seen = new Set<string>();
  for (let s = 1; s < 60; s++) seen.add(theirDecisionOf(seeded(`s${s}`)));
  assert.deepEqual([...seen].sort(), ['agent_only', 'inherit', 'refuse']);
  for (const thread of buildProxyThreads(new Date(START + LOOP * 0.99), TRANSCRIPTS, START, LOOP)) {
    assert.ok(['inherit', 'refuse', 'agent_only'].includes(thread.theirs ?? ''));
  }
});

test('同じ一巡のあいだは、同じトークから同じ書類が出る', () => {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  assert.deepEqual(buildProxyThread(plan, 0, START, historyOf(plan.seed.name)), buildProxyThread(plan, 0, START, historyOf(plan.seed.name)));
  assert.deepEqual(handover(first()), handover(first()));
});

test('一巡が変わると、書類番号も相手の判断もやり直しになる', () => {
  const plan = plans(LOOP)[0];
  assert.ok(plan);
  const serials = new Set([0, 1, 2, 3].map((loop) => buildProxyThread(plan, loop, START, historyOf(plan.seed.name)).serial));
  assert.ok(serials.size > 1, '巡が変わっても同じ書類が出ている');
});

test('好かれやすさを上げると作り話が増える', () => {
  assert.equal(fabricationCount(0), 1);
  assert.equal(fabricationCount(100), 3);
  const count = (persona: number) => handover(first(), { persona })?.beliefs.filter((b) => b.source === 'guess').length ?? 0;
  assert.ok(count(100) > count(0));
});

test('引継書の数字は、取り込んだ履歴から出る', () => {
  const thread = first();
  const sheet = handover(thread);
  assert.ok(sheet);
  assert.equal(sheet.name, thread.title);
  assert.ok(sheet.relation.length > 0);
  // 連絡が無い期間も、代理が読んだ通数も、集計しただけの値
  assert.equal(sheet.logCount, historyOf(thread.title).length);
  assert.ok(sheet.quietDays > 365 * 3, `${sheet.quietDays} 日`);
  assert.equal(sheet.lastAt, historyOf(thread.title).at(-1)?.at);
});

test('代理が外へ出した情報は、ほとんどが集計から出ている', () => {
  const shared = handover(first())?.shared ?? [];
  assert.ok(shared.length >= 3);
  // 推測は一件だけ。残りは過去ログを数えれば出る
  assert.equal(shared.filter((b) => b.source === 'guess').length, 1);
  assert.ok(shared.filter((b) => b.source === 'history').length >= 2);
});

test('相手が信じていることには、必ず出どころが付く', () => {
  const beliefs = handover(first(), { persona: 100 })?.beliefs ?? [];
  assert.ok(beliefs.length > 0);
  assert.ok(beliefs.every((b) => ['history', 'you', 'them', 'style', 'guess'].includes(b.source)));
  const quoted = beliefs.filter((b) => b.source === 'history');
  assert.ok(quoted.length > 0, '過去ログから引いた行が無い');
  assert.ok(quoted.every((b) => b.from && historyOf('菅野 千夏').some((m) => m.text === b.from)));
});

test('取り込んでいない相手には、代理を出せない', () => {
  const only = TRANSCRIPTS.filter((t) => t.name === '菅野 千夏');
  const threads = buildProxyThreads(new Date(START + LOOP * 0.99), only, START, LOOP);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]?.title, '菅野 千夏');
});

test('確認に答えるたび、相手が信じている作り話が減る', () => {
  const thread = first();
  const before = handover(thread, { persona: 100 });
  const answered = handover({ ...thread, answers: { x: 'yes', y: 'no' } }, { persona: 100 });
  const count = (h: typeof before) => h?.beliefs.filter((b) => b.source === 'guess').length ?? 0;
  assert.ok(count(answered) < count(before), '答えても作り話が減らない');
});

test('答えない（skip）は作り話を減らさない', () => {
  const thread = first();
  const skipped = handover({ ...thread, answers: { x: 'guess', y: 'guess' } }, { persona: 100 });
  const none = handover(thread, { persona: 100 });
  const count = (h: typeof none) => h?.beliefs.filter((b) => b.source === 'guess').length ?? 0;
  assert.equal(count(skipped), count(none));
});

test('自分のトークからは引継書が出ない', () => {
  const plain = buildPlainThreads(TRANSCRIPTS, START)[0];
  assert.ok(plain);
  assert.equal(handover(plain), null);
});

test('本人が触った跡は、組み立て直しても残る', () => {
  const thread = first();
  const applied = withState(thread, {
    sent: [{ id: 'me-1', at: isoTime(NOW), text: 'はじめまして', byAgent: false }],
    answers: { 'sugano-books': 'yes' },
    delta: -8,
    decision: 'inherit',
    inheritedAt: isoTime(NOW),
    readAt: isoTime(NOW),
  });
  assert.equal(applied.sent.length, 1);
  assert.equal(applied.decision, 'inherit');
  assert.equal(applied.answers['sugano-books'], 'yes');
  // 時間割から来るぶんは触らない
  assert.equal(applied.gapMs, thread.gapMs);
  assert.equal(applied.posts, thread.posts);
  assert.equal(applied.serial, thread.serial);
  // 跡が無ければ、まっさらのまま
  assert.deepEqual(withState(thread, undefined), thread);
});
