import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bubblesOf, CHECK_ANSWER, CHECK_QUESTION, CHECK_REPLY_MS, daysSinceInherit, isLive, isReady, nextPost, pendingAsksOf, postsShown, previewOf, storyDay, unreadOf } from './threads.ts';
import { buildPlainThreads, buildProxyThread } from './generate.ts';
import { DEFAULT_LOOP_MS, plans, type Plan } from './loop.ts';
import { SAMPLE_TRANSCRIPTS } from './sample.ts';
import { parseAll } from './transcript.ts';
import { isoTime, type Thread } from './types.ts';

const TRANSCRIPTS = parseAll(SAMPLE_TRANSCRIPTS);

function historyOf(name: string) {
  return TRANSCRIPTS.find((t) => t.name === name)?.messages ?? [];
}

const LOOP = DEFAULT_LOOP_MS;
const START = new Date('2026-08-31T12:00:00.000Z').getTime();

function planFor(seedId: string): Plan {
  const plan = plans(LOOP).find((p) => p.slot.seedId === seedId);
  if (!plan) throw new Error(`${seedId} の時間割が無い`);
  return plan;
}

/** 一巡目の、そのトークを作る。sugano は満了済み、toda は始まったばかり。 */
function proxy(seedId: string, over: Partial<Thread> = {}): Thread {
  const plan = planFor(seedId);
  return { ...buildProxyThread(plan, 0, START, historyOf(plan.seed.name)), ...over };
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
    const seen = bubblesOf(thread, new Date(at + n * thread.gapMs));
    assert.equal(postsShown(thread, new Date(at + n * thread.gapMs)), n);
    // 先頭の開示は台本の外なので、数から外す
    assert.equal(seen.filter((b) => !b.system).length, n);
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

test('やり取りが終わった代理のトークだけ引継書を読める', () => {
  assert.equal(isReady(proxy('sugano'), appears('sugano')), true);
  assert.equal(isReady(proxy('komatsu'), appears('komatsu')), false);
  // 判断済みのトークはもう読めない
  assert.equal(isReady(proxy('sugano', { decision: 'inherit' }), appears('sugano')), false);
  assert.equal(isReady(buildPlainThreads(TRANSCRIPTS, START)[0] as Thread, appears('sugano')), false);
});

test('代理のトークは、いまの時刻までのやり取りしか出ない', () => {
  const young = proxy('toda');
  const early = bubblesOf(young, new Date(appears('toda').getTime() + 3 * young.gapMs));
  const full = bubblesOf(proxy('sugano'), appears('sugano'));
  assert.ok(early.length > 0, '始まったばかりでも何通かは出る');
  assert.ok(full.length > early.length);
  // 全部が代理人の書いたものとして印が付く
  // 開示以外は、全部が代理の書いたもの
  assert.ok(full.filter((b) => !b.system).every((b) => b.byAgent));
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

test('答えないまま猶予を過ぎると代理が埋め、その一文が作り話になる', () => {
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

test('「いいえ」と答えると、代理が訂正する', () => {
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
  assert.equal(divider.divider, 'ここから自分で返事をします');
  const mine = bubbles.find((b) => b.id === 'me-1');
  assert.ok(mine);
  assert.equal(mine.byAgent, false);
  assert.equal(mine.side, 'right');
});

test('相手が代理に任せた場合でも、引き継いだあとの相手の発言に印は付かない', () => {
  /*
   * 以前は相手側の代理の発言に「代」の印が付いていた。いまは付けない——
   * **相手が人間か代理かは、トークの中では確かめられない**ことにしたため。
   * 届く言葉は違うが、色と印は同じ。
   */
  const at = appears('sugano');
  const base = { decision: 'inherit' as const, inheritedAt: isoTime(at) };
  const human = proxy('sugano', { ...base, theirs: 'inherit' });
  const agent = proxy('sugano', { ...base, theirs: 'agent_only' });
  const later = new Date(at.getTime() + 3 * human.gapMs);
  const left = (t: Thread) => bubblesOf(t, later).filter((b) => b.side === 'left' && b.id.startsWith('f-'));
  assert.ok(left(human).length > 0);
  assert.ok(left(human).every((b) => !b.byAgent && b.unknown));
  assert.ok(left(agent).every((b) => !b.byAgent && b.unknown));
  // 言葉は違う
  assert.notDeepEqual(
    left(human).map((b) => b.text),
    left(agent).map((b) => b.text),
  );
});

test('自分のトークは止まっていて、送ると一度だけ返事が来る', () => {
  const now = new Date(START);
  const plain = buildPlainThreads(TRANSCRIPTS, START).find((t) => t.title === '川口');
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
  const quiet = buildPlainThreads(TRANSCRIPTS, START).find((t) => t.title === 'さやか');
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
  const plain = buildPlainThreads(TRANSCRIPTS, START)[0];
  assert.ok(plain);
  assert.equal(unreadOf(plain, bubblesOf(plain, new Date(START))), 0);
});

test('引き継ぎからの経過も、そのトークの速さで進む', () => {
  const at = appears('sugano');
  const thread = proxy('sugano', { decision: 'inherit', inheritedAt: isoTime(at) });
  assert.equal(daysSinceInherit(thread, at), 0);
  assert.equal(daysSinceInherit(thread, new Date(at.getTime() + 5 * thread.gapMs)), 5);
});

test('開示は、いちばん最初に必ず立つ', () => {
  /*
   * AI 法第 50 条（2026-08-02 適用）は、最初のやり取りの時点で AI だと明示する
   * ことを求めている。**開示されているのに、誰も見ていない**——そこがこの作品の
   * 芯なので、抜けていないことを試験で押さえる。
   */
  for (const id of ['sugano', 'toda', 'komatsu']) {
    const bubbles = bubblesOf(proxy(id), appears(id));
    assert.equal(bubbles[0]?.system, 'このトークは自動応答です。相手側も同じです。（AI法 第50条）', id);
  }
  // 自分のトークには立たない。人間しかいないので
  const plain = buildPlainThreads(TRANSCRIPTS, START)[0];
  assert.ok(plain);
  assert.ok(bubblesOf(plain, new Date(START)).every((b) => !b.system));
});

test('代理の一通目は、過去ログから引いている', () => {
  /*
   * 「AI がなぜか知っている」を消すための決まり。最初の一通には出どころが付き、
   * **引いた一通をそのまま出せる。**
   */
  const first = bubblesOf(proxy('hiranuma'), new Date(appears('hiranuma').getTime() + 2 * planFor('hiranuma').gapMs)).find(
    (b) => !b.system,
  );
  assert.ok(first);
  assert.equal(first.source, 'history');
  assert.ok(first.from, '引いた一通が出せていない');
  // 引用は、取り込んだ履歴のなかに実在する
  assert.ok(historyOf('平沼 悟').some((m) => m.text === first.from), '過去ログに無い文を引いている');
});

test('相手側の発言は「相手から聞いたこと」になる', () => {
  const bubbles = bubblesOf(proxy('sugano'), appears('sugano'));
  assert.ok(bubbles.filter((b) => b.side === 'left' && !b.system).every((b) => b.source === 'them'));
});

test('答えれば「本人」、放っておけば「推測」になる', () => {
  const bare = proxy('toda');
  const { at, id } = firstAsk(bare, appears('toda'));
  const later = new Date(at.getTime() + 40_000);
  const guessed = bubblesOf(bare, later).find((b) => b.id.startsWith('askr-'));
  const answered = bubblesOf(proxy('toda', { answers: { [id]: 'yes' } }), later).find((b) => b.id.startsWith('askr-'));
  assert.equal(guessed?.source, 'guess');
  assert.equal(answered?.source, 'you');
});

test('自分のトークは、取り込んだ履歴がそのまま出る', () => {
  const plain = buildPlainThreads(TRANSCRIPTS, START).find((t) => t.title === '桜井 まりえ');
  assert.ok(plain);
  const bubbles = bubblesOf(plain, new Date(START));
  assert.equal(bubbles.length, historyOf('桜井 まりえ').length);
  assert.equal(bubbles[0]?.text, historyOf('桜井 まりえ')[0]?.text);
  // 代理は一言も混ざらない
  assert.ok(bubbles.every((b) => !b.byAgent));
});

test('引き継いだあとの相手側は、人間か代理か分からない色になる', () => {
  const at = appears('sugano');
  const inheritedAt = new Date(at.getTime() + 60_000);
  for (const theirs of ['inherit', 'agent_only', 'refuse', undefined] as const) {
    const thread = proxy('sugano', { decision: 'inherit', inheritedAt: isoTime(inheritedAt), ...(theirs ? { theirs } : {}) });
    const later = new Date(inheritedAt.getTime() + 2 * thread.gapMs);
    const after = bubblesOf(thread, later).filter((b) => b.at >= thread.inheritedAt! && b.side === 'left');
    assert.ok(after.length >= 2, `相手から届いていない（${theirs}）`);
    // 相手側の判断がどうであれ、吹き出しには出ない
    assert.ok(after.every((b) => b.unknown === true && b.byAgent === false), `相手側の正体が吹き出しに出ている（${theirs}）`);
  }
});

test('「本人ですか？」と訊くと、少し置いて「はい、本人です」とだけ返る', () => {
  const at = appears('sugano');
  const inheritedAt = new Date(at.getTime() + 60_000);
  const asked = new Date(inheritedAt.getTime() + 5_000);
  const thread = proxy('sugano', { decision: 'inherit', inheritedAt: isoTime(inheritedAt), theirs: 'agent_only', checks: [isoTime(asked)] });
  const soon = bubblesOf(thread, new Date(asked.getTime() + 500));
  assert.ok(soon.some((b) => b.id.startsWith('chk-q-') && b.text === CHECK_QUESTION && b.side === 'right'));
  assert.ok(!soon.some((b) => b.id.startsWith('chk-a-')), '即答している');
  const later = bubblesOf(thread, new Date(asked.getTime() + CHECK_REPLY_MS + 100));
  const answer = later.find((b) => b.id.startsWith('chk-a-'));
  assert.ok(answer);
  assert.equal(answer.text, CHECK_ANSWER);
  // 相手が代理でも、答えは同じで、色も分からないまま
  assert.equal(answer.unknown, true);
  assert.equal(answer.byAgent, false);
});

test('差し戻すと、自分で書いたぶんは残り、仕切りの下で代理が続きを打つ', () => {
  const at = appears('sugano');
  const inheritedAt = new Date(at.getTime() + 60_000);
  const returnedAt = new Date(inheritedAt.getTime() + 20_000);
  const sent = [{ id: 'me-1', at: isoTime(new Date(inheritedAt.getTime() + 5_000)), text: '千夏ちゃん、久しぶり', byAgent: false }];
  const thread = proxy('sugano', { decision: 'returned', inheritedAt: isoTime(inheritedAt), returnedAt: isoTime(returnedAt), sent });

  // 戻した直後は、まだ代理の一通は無い
  const justNow = bubblesOf(thread, new Date(returnedAt.getTime() + 1_000));
  assert.ok(justNow.some((b) => b.id === 'me-1'), '自分で書いたぶんが消えている');
  assert.ok(!justNow.some((b) => b.id.startsWith('r-')));
  assert.ok(isLive(thread, new Date(returnedAt.getTime() + 1_000)), '代理が続けている印が無い');

  // 一通ぶん経つと、代理が戻されたことに触れる一言を打つ。仕切りが付く
  const one = bubblesOf(thread, new Date(returnedAt.getTime() + thread.gapMs + 100));
  const first = one.find((b) => b.id.startsWith('r-'));
  assert.ok(first);
  assert.equal(first.side, 'right');
  assert.equal(first.byAgent, true);
  assert.equal(first.divider, 'ここから代理に戻します');
  assert.ok(first.text.includes('揺れていた'));
  assert.ok(one.at(-1)?.id === first.id);

  // 相手側の言葉は、人間か代理か分からない色のまま
  const three = bubblesOf(thread, new Date(returnedAt.getTime() + 3 * thread.gapMs + 100));
  const left = three.filter((b) => b.id.startsWith('r-') && b.side === 'left');
  assert.ok(left.length >= 1);
  assert.ok(left.every((b) => b.unknown && !b.byAgent));

  // 出し切ると止まる
  const done = new Date(returnedAt.getTime() + 20 * thread.gapMs);
  assert.equal(bubblesOf(thread, done).filter((b) => b.id.startsWith('r-')).length, 6);
  assert.ok(!isLive(thread, done));
  assert.equal(nextPost(thread, done), null);
});

test('差し戻しても近さは戻らず、戻した時点で止まる', () => {
  const at = appears('sugano');
  const inheritedAt = new Date(at.getTime() + 60_000);
  const returnedAt = new Date(inheritedAt.getTime() + 5 * DEFAULT_LOOP_MS * 0.0097);
  const thread = proxy('sugano', { decision: 'returned', inheritedAt: isoTime(inheritedAt), returnedAt: isoTime(returnedAt), delta: -14 });
  const atReturn = daysSinceInherit(thread, returnedAt);
  assert.ok(atReturn >= 4);
  // 戻したあと、いくら経っても増えない（＝下がり続けない）
  assert.equal(daysSinceInherit(thread, new Date(returnedAt.getTime() + 50 * thread.gapMs)), atReturn);
  // 下がったぶんはそのまま
  assert.equal(thread.delta, -14);
});
