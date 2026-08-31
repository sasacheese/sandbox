import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bubblesOf, daysSinceInherit, isReady, pendingAsksOf, postsShown, previewOf, storyDay, unreadOf } from './threads.ts';
import { buildPlainThreads, buildProxyThread } from './generate.ts';
import { DEFAULT_LOOP_MS, plans, type Plan } from './loop.ts';
import { isoTime, type Thread } from './types.ts';

const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();

function planFor(seedId: string): Plan {
  const plan = plans(LOOP).find((p) => p.slot.seedId === seedId);
  if (!plan) throw new Error(`${seedId} の時間割が無い`);
  return plan;
}

/** 一巡目の、そのトークを作る。sugano は満了済み、toda は始まったばかり。 */
function proxy(seedId: string, over: Partial<Thread> = {}): Thread {
  return { ...buildProxyThread(planFor(seedId), 0, START), ...over };
}

/** そのトークが一覧に現れた瞬間。 */
function appears(seedId: string): Date {
  return new Date(START + planFor(seedId).appearsAt);
}

/** 確認の札が初めて出た時刻を探す。 */
function firstAsk(thread: Thread, from: Date): { at: Date; id: string } {
  for (let i = 0; i < 600; i++) {
    const at = new Date(from.getTime() + i * 1_000);
    const found = bubblesOf(thread, at).find((b) => b.ask);
    if (found?.ask) return { at, id: found.ask.id };
  }
  throw new Error('確認が出ない');
}

test('一通ずつ、等間隔に届く', () => {
  /*
   * 台本の日付どおりに流すと、日付が詰まった区間で二通が同時に出て、空いた
   * 区間で四十秒以上何も起きない（実際にそうなった）。通数で数えれば一定になる。
   */
  const thread = proxy('toda');
  const at = appears('toda').getTime();
  for (const n of [0, 1, 2, 5, 9]) {
    assert.equal(postsShown(thread, new Date(at + n * thread.gapMs)), n);
    assert.equal(bubblesOf(thread, new Date(at + n * thread.gapMs)).length, n);
  }
  // 出し切ったら、それ以上は増えない
  assert.equal(postsShown(thread, new Date(at + (thread.posts + 20) * thread.gapMs)), thread.posts);
});

test('トークごとに間隔が違う', () => {
  // 揃えると一斉に届いて、画面が静かになる
  const paces = new Set(plans(LOOP).map((plan) => plan.gapMs));
  assert.ok(paces.size >= 5);
});

test('日付は表示のうえの目盛りとして進む', () => {
  const thread = proxy('toda');
  const at = appears('toda').getTime();
  assert.equal(storyDay(thread, new Date(at)), thread.headStart);
  const early = storyDay(thread, new Date(at + 3 * thread.gapMs));
  const late = storyDay(thread, new Date(at + 20 * thread.gapMs));
  assert.ok(early > 0);
  assert.ok(late > early, '日付が進んでいない');
  assert.ok(late <= (thread.days ?? 0), '交流期間を超えている');
});

test('満了した代理人のトークだけ引継書を読める', () => {
  assert.equal(isReady(proxy('sugano'), appears('sugano')), true);
  assert.equal(isReady(proxy('komatsu'), appears('komatsu')), false);
  // 判断済みのトークはもう読めない
  assert.equal(isReady(proxy('sugano', { decision: 'inherit' }), appears('sugano')), false);
  assert.equal(isReady(buildPlainThreads(START)[0] as Thread, appears('sugano')), false);
});

test('代理人のトークは、いまの時刻までのやり取りしか出ない', () => {
  const young = proxy('toda');
  const early = bubblesOf(young, new Date(appears('toda').getTime() + 3 * young.gapMs));
  const full = bubblesOf(proxy('sugano'), appears('sugano'));
  assert.ok(early.length > 0, '始まったばかりでも何通かは出る');
  assert.ok(full.length > early.length);
  // 全部が代理人の書いたものとして印が付く
  assert.ok(full.every((b) => b.byAgent));
  // 自分の側にも吹き出しが出る（打っていないのに）
  assert.ok(full.some((b) => b.side === 'right' && !b.ask));
});

test('確認は本人へ向いた札として出る', () => {
  const bubbles = bubblesOf(proxy('sugano'), appears('sugano'));
  const asks = bubbles.filter((b) => b.ask);
  assert.ok(asks.length > 0, '確認が出ていない');
  assert.ok(asks.every((b) => b.side === 'right' && b.byAgent));
});

test('使い始める前に過ぎた確認は、最初から埋まっている', () => {
  // その場にいなかったので、答える機会が無かったぶん
  const bubbles = bubblesOf(proxy('sugano'), appears('sugano'));
  assert.ok(bubbles.some((b) => b.ask?.autoFilled));
  assert.ok(bubbles.some((b) => b.fabricated));
  assert.equal(pendingAsksOf(bubbles), 0, 'もう答えようがないものを促している');
});

test('目の前で出た確認には、実時間の猶予がある', () => {
  const thread = proxy('toda');
  const { at, id } = firstAsk(thread, appears('toda'));
  const shown = bubblesOf(thread, at).find((b) => b.ask?.id === id);
  assert.ok(shown, '確認が出ていない');
  assert.equal(shown.ask?.autoFilled, undefined, '出た直後に埋まっている');
  assert.equal(pendingAsksOf(bubblesOf(thread, at)), 1);

  // 一日が十数秒で流れていても、読んで押すぶんは残る
  const soon = bubblesOf(thread, new Date(at.getTime() + 10_000)).find((b) => b.ask?.id === id);
  assert.equal(soon?.ask?.autoFilled, undefined);

  const later = bubblesOf(thread, new Date(at.getTime() + 40_000)).find((b) => b.ask?.id === id);
  assert.equal(later?.ask?.autoFilled, true, '猶予を過ぎても埋まらない');
});

test('答えないまま猶予を過ぎると代理人が埋め、その一文が作り話になる', () => {
  const thread = proxy('toda');
  const { at, id } = firstAsk(thread, appears('toda'));
  const bubbles = bubblesOf(thread, new Date(at.getTime() + 40_000));
  const outcome = bubbles.find((b) => b.id === `askr-${thread.id}-${id}`);
  assert.ok(outcome, '埋めた跡が無い');
  assert.equal(outcome.fabricated, true);
  assert.equal(outcome.side, 'right');
});

test('答えれば、同じ一文が作り話にならない', () => {
  const bare = proxy('toda');
  const { at, id } = firstAsk(bare, appears('toda'));
  const answered = proxy('toda', { answers: { [id]: 'yes' } });
  const bubbles = bubblesOf(answered, new Date(at.getTime() + 40_000));
  const outcome = bubbles.find((b) => b.id === `askr-${answered.id}-${id}`);
  assert.ok(outcome, '確認の結果が出ていない');
  assert.equal(outcome.fabricated, undefined);
  assert.equal(bubbles.find((b) => b.ask?.id === id)?.ask?.answered, 'yes');
});

test('「いいえ」と答えると、代理人が訂正する', () => {
  const bare = proxy('toda');
  const { at, id } = firstAsk(bare, appears('toda'));
  const later = new Date(at.getTime() + 40_000);
  const pick = (answer: 'yes' | 'no') =>
    bubblesOf(proxy('toda', { answers: { [id]: answer } }), later).find((b) => b.id.startsWith('askr-'));
  const yes = pick('yes');
  const no = pick('no');
  assert.ok(yes && no);
  assert.notEqual(yes.text, no.text);
  assert.equal(no.fabricated, undefined);
});

test('引き継ぐと、仕切りのあとに人間の区間が続く', () => {
  const at = appears('sugano');
  const thread = proxy('sugano', {
    decision: 'inherit',
    inheritedAt: isoTime(at),
    sent: [{ id: 'me-1', at: isoTime(new Date(at.getTime() + planFor('sugano').gapMs)), text: 'はじめまして', byAgent: false }],
  });
  const bubbles = bubblesOf(thread, new Date(at.getTime() + 3 * thread.gapMs));
  const divider = bubbles.find((b) => b.divider);
  assert.ok(divider, '仕切りが無い');
  assert.equal(divider.divider, 'ここから、あなたが応対します');
  const mine = bubbles.find((b) => b.id === 'me-1');
  assert.ok(mine);
  assert.equal(mine.byAgent, false);
  assert.equal(mine.side, 'right');
});

test('相手が代理人に任せた場合、引き継いだあとの相手の発言に代理人の印が付く', () => {
  const at = appears('sugano');
  const base = { decision: 'inherit' as const, inheritedAt: isoTime(at) };
  const human = proxy('sugano', { ...base, theirs: 'inherit' });
  const agent = proxy('sugano', { ...base, theirs: 'agent_only' });
  const later = new Date(at.getTime() + 3 * human.gapMs);
  const left = (t: Thread) => bubblesOf(t, later).filter((b) => b.side === 'left' && b.id.startsWith('f-'));
  assert.ok(left(human).length > 0);
  assert.ok(left(human).every((b) => !b.byAgent));
  assert.ok(left(agent).every((b) => b.byAgent));
});

test('自分のトークは止まっていて、送ると一度だけ返事が来る', () => {
  const now = new Date(START);
  const plain = buildPlainThreads(START).find((t) => t.id === 'kawaguchi');
  assert.ok(plain);
  const before = bubblesOf(plain, now);
  assert.ok(before.length >= 3);
  assert.ok(before.every((b) => !b.byAgent));

  const sent: Thread = { ...plain, sent: [{ id: 'me-1', at: isoTime(now), text: '久しぶり', byAgent: false }] };
  // 送った直後は返っていない
  assert.equal(bubblesOf(sent, now).filter((b) => b.id.startsWith('auto-')).length, 0);
  // しばらく経つと一度だけ返る
  assert.equal(bubblesOf(sent, new Date(START + 60_000)).filter((b) => b.id.startsWith('auto-')).length, 1);
});

test('返してこない相手もいる', () => {
  const quiet = buildPlainThreads(START).find((t) => t.id === 'sayaka');
  assert.ok(quiet);
  const sent: Thread = { ...quiet, sent: [{ id: 'me-1', at: isoTime(new Date(START)), text: '元気？', byAgent: false }] };
  assert.equal(bubblesOf(sent, new Date(START + 600_000)).filter((b) => b.id.startsWith('auto-')).length, 0);
});

test('抜粋と未読は一覧のために出る', () => {
  const thread = proxy('sugano');
  const at = appears('sugano');
  const bubbles = bubblesOf(thread, at);
  const preview = previewOf(bubbles);
  assert.equal(preview.text, bubbles.at(-1)?.text);
  assert.ok(unreadOf(thread, bubbles) > 0);
  const read: Thread = { ...thread, readAt: isoTime(new Date(at.getTime() + 60_000)) };
  assert.equal(unreadOf(read, bubbles), 0);
});

test('自分の過去のやり取りには未読が付かない', () => {
  const plain = buildPlainThreads(START)[0];
  assert.ok(plain);
  assert.equal(unreadOf(plain, bubblesOf(plain, new Date(START))), 0);
});

test('引き継ぎからの経過も、そのトークの速さで進む', () => {
  const at = appears('sugano');
  const thread = proxy('sugano', { decision: 'inherit', inheritedAt: isoTime(at) });
  assert.equal(daysSinceInherit(thread, at), 0);
  assert.equal(daysSinceInherit(thread, new Date(at.getTime() + 5 * thread.gapMs)), 5);
});
