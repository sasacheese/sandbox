import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressSlip, avoidKeyword, slipsOf, type Manner } from './slips.ts';
import type { Tone } from './transcript.ts';

const NO_PERIOD: Tone = { replyMinutes: 38, lateShare: 0, avgLength: 15, period: false };
const PERIOD: Tone = { replyMinutes: 38, lateShare: 0, avgLength: 15, period: true };

const KOMATSU: Manner = { address: '小松さん', name: '小松 遼', calls: 'たくん', avoid: '同期の就職先の話。話題に出ると既読のまま止まる。', tone: NO_PERIOD };
const SUGANO: Manner = { address: '菅野さん', name: '菅野 千夏', calls: 'たつやさん', avoid: '実家の話。触れると返信が半日止まる。', tone: PERIOD };
const ARAI: Manner = { address: '新井さん', name: '新井 のぞみ', calls: 'たつやさん', avoid: '「元気そうでよかった」という言い方。返信が来なくなる。', tone: PERIOD };

test('呼び方：代理と同じ呼び方なら何も出ない', () => {
  assert.equal(addressSlip('小松さん、お久しぶりです', KOMATSU), null);
  assert.equal(addressSlip('また小松さんと話せて', KOMATSU), null);
});

test('呼び方：名や姓を別の敬称で呼ぶと出る', () => {
  assert.deepEqual(addressSlip('遼くん、元気？', KOMATSU), { label: '呼び方が違います', detail: '遼くん → 小松さん' });
  assert.deepEqual(addressSlip('小松くんさ', KOMATSU), { label: '呼び方が違います', detail: '小松くん → 小松さん' });
  assert.deepEqual(addressSlip('千夏ちゃん', SUGANO), { label: '呼び方が違います', detail: '千夏ちゃん → 菅野さん' });
});

test('呼び方：相手があなたを呼ぶ形で相手を呼ぶと出る', () => {
  assert.deepEqual(addressSlip('たくん、久しぶり', KOMATSU), { label: '呼び方が違います', detail: 'たくん → 小松さん' });
});

test('呼び方：第三者の「◯◯さん」は拾わない', () => {
  assert.equal(addressSlip('田中さんにも会いました', KOMATSU), null);
});

test('句点：打たない人が打つと出る。打つ人が打たないと出る', () => {
  assert.ok(slipsOf('久しぶり。元気でしたか。', KOMATSU, null).some((s) => s.label === '句点を打っています'));
  assert.ok(!slipsOf('久しぶり\n元気でしたか', KOMATSU, null).some((s) => s.label.startsWith('句点')));
  assert.ok(slipsOf('お久しぶりです、元気でしたか', SUGANO, null).some((s) => s.label === '句点がありません'));
  assert.ok(!slipsOf('お久しぶりです。', SUGANO, null).some((s) => s.label.startsWith('句点')));
});

test('長さ：平均の倍を超えると出る', () => {
  const long = 'この前はありがとうございました、あれから色々あって連絡できずにいましたが元気にしています、そちらはどうですか';
  const slip = slipsOf(long, SUGANO, null).find((s) => s.label.startsWith('一通'));
  assert.ok(slip);
  assert.equal(slip.detail, '代理は平均 15 文字でした');
});

test('返信の速さ：代理の倍より遅いと出る。もう返してあれば数えない', () => {
  const slow = slipsOf('はい。', SUGANO, 4 * 60 + 12).find((s) => s.label.startsWith('返信'));
  assert.deepEqual(slow, { label: '返信 4 時間 12 分', detail: '代理は 38 分でした' });
  assert.ok(!slipsOf('はい。', SUGANO, 40).some((s) => s.label.startsWith('返信')));
  assert.ok(!slipsOf('はい。', SUGANO, null).some((s) => s.label.startsWith('返信')));
});

test('触れてはいけないこと：語を取り出して照らす', () => {
  assert.deepEqual(avoidKeyword(SUGANO.avoid), { keyword: '実家', topic: '実家の話' });
  assert.deepEqual(avoidKeyword(ARAI.avoid), { keyword: '元気そうでよかった', topic: '「元気そうでよかった」という言い方' });
  assert.deepEqual(avoidKeyword(KOMATSU.avoid), { keyword: '同期の就職先', topic: '同期の就職先の話' });
  const slip = slipsOf('実家のほうはどうですか。', SUGANO, null).find((s) => s.label.startsWith('触れて'));
  assert.deepEqual(slip, { label: '触れてはいけないことに触れています', detail: '実家の話' });
  assert.ok(slipsOf('元気そうでよかった。', ARAI, null).some((s) => s.label.startsWith('触れて')));
});

test('作法どおりなら何も出ない', () => {
  assert.deepEqual(slipsOf('菅野さん、聞きます。', SUGANO, 20), []);
  assert.deepEqual(slipsOf('小松さん、聞きます', KOMATSU, null), []);
});

test('踏み外しは重なる', () => {
  // 呼び方・句点・触れてはいけないこと、の三つ
  const slips = slipsOf('千夏ちゃん、実家のほうはどう', SUGANO, null);
  assert.equal(slips.length, 3);
});
