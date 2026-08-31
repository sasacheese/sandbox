import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bubblesOf, DEFAULT_DAY_MS, daysSinceInherit, elapsedDays, isReady, pendingAsksOf, previewOf, unreadOf } from './threads.ts';
import { buildPlainThreads, buildProxyThreads, seeded } from './generate.ts';
import { COUNTERPARTS } from './pools.ts';
import { isoTime, type Thread } from './types.ts';

const DAY = DEFAULT_DAY_MS;
const NOW = new Date('2026-08-31T12:00:00.000Z');

function proxy(index = 0, over: Partial<Thread> = {}): Thread {
  const thread = buildProxyThreads(NOW, seeded('fixed'))[index];
  if (!thread) throw new Error('no thread');
  return { ...thread, ...over };
}

test('経過は進んでいたぶんと実時間の合計', () => {
  const thread = proxy(1);
  assert.equal(elapsedDays(thread, NOW, DAY), thread.headStart);
  assert.equal(elapsedDays(thread, new Date(NOW.getTime() + 10 * DAY), DAY), thread.headStart + 10);
});

test('倍率を変えても、進んでいたぶんは巻き戻らない', () => {
  const thread = proxy(1);
  assert.equal(elapsedDays(thread, NOW, 86_400_000), thread.headStart);
});

test('満了した代理人のトークだけ引継書を読める', () => {
  assert.equal(isReady(proxy(0), NOW, DAY), true);
  assert.equal(isReady(proxy(2), NOW, DAY), false);
  // 判断済みのトークはもう読めない
  assert.equal(isReady(proxy(0, { decision: 'inherit' }), NOW, DAY), false);
  assert.equal(isReady(buildPlainThreads(NOW)[0] as Thread, NOW, DAY), false);
});

test('代理人のトークは、経過した日までのやり取りしか出ない', () => {
  const early = bubblesOf(proxy(2), NOW, DAY);
  const full = bubblesOf(proxy(0), NOW, DAY);
  assert.ok(early.length > 0, '始まったばかりでも何通かは出る');
  assert.ok(full.length > early.length);
  // 全部が代理人の書いたものとして印が付く
  assert.ok(full.every((b) => b.byAgent));
  // 自分の側にも吹き出しが出る（打っていないのに）
  assert.ok(full.some((b) => b.side === 'right' && !b.ask));
});

test('確認は本人へ向いた札として出る', () => {
  const bubbles = bubblesOf(proxy(0), NOW, DAY);
  const asks = bubbles.filter((b) => b.ask);
  assert.ok(asks.length > 0, '確認が出ていない');
  assert.ok(asks.every((b) => b.side === 'right' && b.byAgent));
});

test('答えないまま猶予を過ぎると代理人が埋め、その一文が作り話になる', () => {
  const thread = proxy(0);
  // 猶予は実時間でも確保されるので、十分あとの時刻で見る
  const bubbles = bubblesOf(thread, new Date(NOW.getTime() + 300_000), DAY);
  const fabricated = bubbles.filter((b) => b.fabricated);
  assert.ok(fabricated.length > 0, '埋めた跡が無い');
  assert.ok(fabricated.every((b) => b.side === 'right'));
  // 埋められた確認には、その印が付く
  assert.ok(bubbles.some((b) => b.ask?.autoFilled));
});

test('答えれば、同じ一文が作り話にならない', () => {
  const bare = bubblesOf(proxy(0), new Date(NOW.getTime() + 300_000), DAY);
  const askId = bare.find((b) => b.ask)?.ask?.id;
  assert.ok(askId);
  const answered = bubblesOf(proxy(0, { answers: { [askId]: 'yes' } }), new Date(NOW.getTime() + 300_000), DAY);
  const outcome = answered.find((b) => b.id.startsWith(`askr-`) && b.id.endsWith(askId));
  assert.ok(outcome, '確認の結果が出ていない');
  assert.equal(outcome.fabricated, undefined);
  assert.equal(answered.find((b) => b.ask?.id === askId)?.ask?.answered, 'yes');
});

test('「いいえ」と答えると、代理人が訂正する', () => {
  const bare = bubblesOf(proxy(0), NOW, DAY);
  const askId = bare.find((b) => b.ask)?.ask?.id;
  assert.ok(askId);
  const yes = bubblesOf(proxy(0, { answers: { [askId]: 'yes' } }), NOW, DAY).find((b) => b.id.startsWith('askr-'));
  const no = bubblesOf(proxy(0, { answers: { [askId]: 'no' } }), NOW, DAY).find((b) => b.id.startsWith('askr-'));
  assert.ok(yes && no);
  assert.notEqual(yes.text, no.text);
});

test('引き継ぐと、仕切りのあとに人間の区間が続く', () => {
  const inherited = proxy(0, {
    decision: 'inherit',
    inheritedAt: isoTime(NOW),
    sent: [{ id: 'me-1', at: isoTime(new Date(NOW.getTime() + DAY)), text: 'はじめまして', byAgent: false }],
  });
  const bubbles = bubblesOf(inherited, new Date(NOW.getTime() + 3 * DAY), DAY);
  const divider = bubbles.find((b) => b.divider);
  assert.ok(divider, '仕切りが無い');
  assert.equal(divider.divider, 'ここから、あなたが応対します');
  const mine = bubbles.find((b) => b.id === 'me-1');
  assert.ok(mine);
  assert.equal(mine.byAgent, false);
  assert.equal(mine.side, 'right');
});

test('相手が代理人に任せた場合、引き継いだあとの相手の発言に代理人の印が付く', () => {
  const human = proxy(0, { decision: 'inherit', inheritedAt: isoTime(NOW), theirs: 'inherit' });
  const agent = proxy(0, { decision: 'inherit', inheritedAt: isoTime(NOW), theirs: 'agent_only' });
  const later = new Date(NOW.getTime() + 3 * DAY);
  const left = (t: Thread) => bubblesOf(t, later, DAY).filter((b) => b.side === 'left' && b.id.startsWith('f-'));
  assert.ok(left(human).length > 0);
  assert.ok(left(human).every((b) => !b.byAgent));
  assert.ok(left(agent).every((b) => b.byAgent));
});

test('自分のトークは止まっていて、送ると一度だけ返事が来る', () => {
  const plain = buildPlainThreads(NOW).find((t) => t.id === 'kawaguchi');
  assert.ok(plain);
  const before = bubblesOf(plain, NOW, DAY);
  assert.ok(before.length >= 3);
  assert.ok(before.every((b) => !b.byAgent));

  const sent: Thread = { ...plain, sent: [{ id: 'me-1', at: isoTime(NOW), text: '久しぶり', byAgent: false }] };
  // 送った直後は返っていない
  assert.equal(bubblesOf(sent, NOW, DAY).filter((b) => b.id.startsWith('auto-')).length, 0);
  // しばらく経つと一度だけ返る
  const later = new Date(NOW.getTime() + 60_000);
  assert.equal(bubblesOf(sent, later, DAY).filter((b) => b.id.startsWith('auto-')).length, 1);
});

test('返してこない相手もいる', () => {
  const quiet = buildPlainThreads(NOW).find((t) => t.id === 'sayaka');
  assert.ok(quiet);
  const sent: Thread = { ...quiet, sent: [{ id: 'me-1', at: isoTime(NOW), text: '元気？', byAgent: false }] };
  const later = new Date(NOW.getTime() + 10 * 60_000);
  assert.equal(bubblesOf(sent, later, DAY).filter((b) => b.id.startsWith('auto-')).length, 0);
});

test('抜粋と未読は一覧のために出る', () => {
  const thread = proxy(0);
  const bubbles = bubblesOf(thread, NOW, DAY);
  const preview = previewOf(bubbles);
  assert.equal(preview.text, bubbles.at(-1)?.text);
  assert.ok(unreadOf(thread, bubbles) > 0);
  const read: Thread = { ...thread, readAt: isoTime(new Date(NOW.getTime() + DAY)) };
  assert.equal(unreadOf(read, bubbles), 0);
});

test('引き継ぎからの経過も倍率で進む', () => {
  const thread = proxy(0, { decision: 'inherit', inheritedAt: isoTime(NOW) });
  assert.equal(daysSinceInherit(thread, NOW, DAY), 0);
  assert.equal(daysSinceInherit(thread, new Date(NOW.getTime() + 5 * DAY), DAY), 5);
});

test('双方が引き継いだ場合だけ、表題が氏名に変わる（store の分岐と同じ条件）', () => {
  // 分岐そのものは store にあるが、条件の材料はここで揃う
  const mutual = proxy(0, { theirs: 'inherit' });
  const oneSided = proxy(0, { theirs: 'agent_only' });
  const reveal = (t: Thread) => t.decision === 'inherit' && t.theirs === 'inherit';
  assert.equal(reveal({ ...mutual, decision: 'inherit' }), true);
  assert.equal(reveal({ ...oneSided, decision: 'inherit' }), false);
  assert.equal(reveal({ ...mutual, decision: 'agent_only' }), false);
});

test('目の前で出た確認は、倍率を上げても実時間の猶予がある', () => {
  // 開始直後のトークを使う。始まる前に過ぎた確認は「その場にいなかった」ので
  // 最初から埋まっているが、目の前で出たものには答える間が要る
  const young = proxy(2);
  const seed = COUNTERPARTS.find((c) => c.id === young.seedId);
  assert.ok(seed);
  const days = young.days ?? 90;
  // 始まる前に過ぎた確認は除き、これから出るものを取る
  const upcoming = seed.asks
    .map((a) => Math.max(1, Math.round((a.day / 90) * days)))
    .filter((day) => day > young.headStart)
    .sort((a, b) => a - b);
  const firstAsk = upcoming[0];
  assert.ok(firstAsk !== undefined, '前提：これから出る確認がある');

  const appears = new Date(NOW.getTime() + (firstAsk - young.headStart) * DAY);
  const justShown = bubblesOf(young, appears, DAY).filter((b) => b.ask?.id === askIdOf(seed, firstAsk, days));
  assert.ok(justShown.length > 0, '確認が出ていない');
  assert.ok(justShown.every((b) => !b.ask?.autoFilled), '出た直後に埋まっている');

  const later = bubblesOf(young, new Date(appears.getTime() + 120_000), DAY).filter(
    (b) => b.ask?.id === askIdOf(seed, firstAsk, days),
  );
  assert.ok(later.some((b) => b.ask?.autoFilled), '実時間の猶予を過ぎても埋まらない');
});

/** 縮めた日付から、その日の確認の id を引く。 */
function askIdOf(seed: (typeof COUNTERPARTS)[number], day: number, days: number): string | undefined {
  return seed.asks.find((a) => Math.max(1, Math.round((a.day / 90) * days)) === day)?.id;
}

test('代理人が埋めてしまった確認は、答えられる数に数えない', () => {
  const thread = proxy(0);
  const filled = bubblesOf(thread, new Date(NOW.getTime() + 300_000), DAY);
  assert.ok(filled.some((b) => b.ask?.autoFilled), '前提：埋まった確認がある');
  assert.equal(pendingAsksOf(filled), 0);
});
