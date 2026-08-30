/**
 * コミュニティを進める。
 *
 *   OPENAI_API_KEY=... node scripts/generate.mjs
 *   node scripts/generate.mjs --check   # 生成せず、いまの feed.json を検査するだけ
 *
 * GitHub Actions から数時間おきに走らせる前提。鍵は Actions の中だけで使う。
 * **ブラウザからは絶対に呼ばない**——GitHub Pages が配るものは誰でも読めるので、
 * 鍵を成果物へ入れた時点で公開したことになる。
 *
 * 時刻と id はこちらで振る。モデルに決めさせると、未来の時刻や重複した id が
 * 混ざって過去ログが壊れる。モデルに任せるのは**文面と、誰が書いたか**だけ。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FEED = resolve(ROOT, 'content', 'feed.json');
const RESIDENTS = resolve(ROOT, 'content', 'residents.json');

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const KEY = process.env.OPENAI_API_KEY;

/** 過去ログは 160 投稿まで。これを超えると古い順に捨てる。 */
const MAX_POSTS = 160;

const feed = JSON.parse(readFileSync(FEED, 'utf8'));
const residents = JSON.parse(readFileSync(RESIDENTS, 'utf8'));

if (process.argv.includes('--check')) {
  validate(feed, residents);
  console.log(`ok: ${feed.posts.length} posts / ${feed.gatherings.length} gatherings`);
  process.exit(0);
}

if (!KEY) {
  console.error('OPENAI_API_KEY が無い');
  process.exit(1);
}

const now = new Date();

/*
 * 過ぎた集まりは done にする。
 *
 * 開催時刻から 6 時間で締める。締めた直後の回だけ「報告を書かせる」ことにして、
 * 誰も報告しないまま流れていくのを防ぐ。
 */
let justFinished = null;
for (const gathering of feed.gatherings) {
  if (gathering.status !== 'upcoming') continue;
  if (new Date(gathering.at).getTime() + 6 * 3_600_000 <= now.getTime()) {
    gathering.status = 'done';
    justFinished = gathering;
  }
}

const upcoming = feed.gatherings.find((g) => g.status === 'upcoming') ?? null;
// 予定が無いときだけ、たまに新しい集まりが立つ。毎回立つと予定表になる
const wantGathering = !upcoming && !justFinished && Math.random() < 0.4;

const recent = feed.posts.slice(-18);
const output = await ask(buildPrompt({ recent, upcoming, justFinished, wantGathering }));

apply(output);
feed.generatedAt = now.toISOString();
validate(feed, residents);
writeFileSync(FEED, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
console.log(`追加: 投稿 ${output.posts?.length ?? 0} / 返信 ${output.replies?.length ?? 0}${output.gathering ? ' / 集まり 1' : ''}`);

// ---------------------------------------------------------------- 生成

function buildPrompt({ recent, upcoming, justFinished, wantGathering }) {
  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now);

  const log = recent
    .map((post) => {
      const head = `[${post.id}] ${post.author}（${jstTime(post.at)}）\n${post.body}`;
      const replies = post.replies.map((r) => `  └ ${r.author}（${jstTime(r.at)}）${r.body}`).join('\n');
      return replies ? `${head}\n${replies}` : head;
    })
    .join('\n\n');

  const roster = residents.map((r) => `- ${r.handle}：${r.bio || '（自己紹介なし）'} / 口調：${r.voice}`).join('\n');

  const asks = [
    '新しい投稿を 1〜3 件',
    '既存の投稿への返信を 1〜5 件',
    wantGathering ? '次の集まりの告知を 1 件（gathering に入れる）' : null,
    justFinished ? `直前に終わった集まり「${justFinished.title}」（${jstTime(justFinished.at)} / ${justFinished.place}）の報告を、投稿として 1 件` : null,
    upcoming ? `開催予定の集まり「${upcoming.title}」（${jstTime(upcoming.at)} / ${upcoming.place}）に参加表明する住人がいれば attend に handle を入れる` : null,
  ].filter(Boolean);

  return `あなたは「よみち」という小さなオンラインコミュニティの、住人たち全員をまとめて書く。夜の散歩と街歩きについて雑談する掲示板で、東京の中野・高円寺・東中野のあたりを歩いている人たちが集まっている。

現在の日時（日本時間）: ${jst}

住人:
${roster}

直近の書き込み:
${log}

やること:
${asks.map((a) => `- ${a}`).join('\n')}

守ること:
- 日本語。各住人の口調を守る。書き手によって文体がはっきり違うこと。
- **既に出ている話題を引き継ぐ**。工事の柵、消えている街灯、閉店した店、コインランドリーなど、進展や後日談を書く。全部を毎回持ち出さない。
- 生活の断片として書く。観光案内・グルメ紹介・自己啓発にしない。まとめない。オチをつけない。
- 一投稿は 1〜4 行。長文にしない。
- AI・人工知能・生成といった語を出さない。この掲示板にそういう話題は無い。
- 絵文字とハッシュタグを使わない。
- 実在の店名・人名を断定的に書かない。
- 誰も他人を持ち上げすぎない。褒め合いの場ではない。

次の JSON だけを返す。前置きも説明も付けない。
{
  "posts": [{"author": "住人の handle", "body": "本文"}],
  "replies": [{"postId": "返信先の [] の中の id", "author": "住人の handle", "body": "本文"}],
  "attend": ["参加表明する住人の handle"],
  "gathering": {"title": "短い題", "place": "集合場所", "by": "言い出した住人の handle", "body": "告知の本文"}
}
posts と replies は必須。attend と gathering は不要なら省く。`;
}

/**
 * モデルへ問い合わせる。
 *
 * 新しめのモデルは /v1/responses、それ以外は /v1/chat/completions を使う。
 * どちらが通るか環境で変わるので、順に試して最初に通った方を使う。
 */
async function ask(prompt) {
  const errors = [];
  for (const call of [viaResponses, viaChat]) {
    try {
      const text = await call(prompt);
      const parsed = parseJson(text);
      if (parsed) return parsed;
      errors.push(`${call.name}: JSON として読めなかった\n${text.slice(0, 400)}`);
    } catch (e) {
      errors.push(`${call.name}: ${e.message}`);
    }
  }
  console.error(errors.join('\n---\n'));
  process.exit(1);
}

async function viaResponses(prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, input: prompt }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const parts = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((c) => c.text)
    .filter((t) => typeof t === 'string');
  if (parts.length === 0) throw new Error('応答に本文が無い');
  return parts.join('');
}

async function viaChat(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('応答に本文が無い');
  return text;
}

/** モデルは前置きや ``` を付けたがるので、最初の JSON らしき塊だけを取り出す。 */
function parseJson(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 反映

function apply(output) {
  const handles = new Set(residents.map((r) => r.handle));
  const known = (handle) => (handles.has(handle) ? handle : residents[Math.floor(Math.random() * residents.length)].handle);

  if (output.gathering) {
    const gathering = {
      id: nextId('g'),
      title: String(output.gathering.title ?? '歩く').slice(0, 24),
      at: nextGatheringTime().toISOString(),
      place: String(output.gathering.place ?? '中野四丁目 バス停前').slice(0, 40),
      by: known(output.gathering.by),
      note: '',
      attendees: [known(output.gathering.by)],
      status: 'upcoming',
    };
    feed.gatherings.push(gathering);
    feed.posts.push({
      id: nextId('p'),
      author: gathering.by,
      at: stamp(0),
      body: String(output.gathering.body ?? '').slice(0, 400) || `${jstTime(gathering.at)} / ${gathering.place}\n集まった人で歩きます。`,
      likes: 0,
      gatheringId: gathering.id,
      replies: [],
    });
  }

  // 新しい投稿は、前回の生成から今までのあいだにばらけさせる
  const posts = (output.posts ?? []).slice(0, 3);
  posts.forEach((post, i) => {
    const body = String(post.body ?? '').trim();
    if (!body) return;
    feed.posts.push({
      id: nextId('p'),
      author: known(post.author),
      at: stamp(20 + i * 25 + Math.floor(Math.random() * 15)),
      body: body.slice(0, 400),
      likes: Math.floor(Math.random() * 6),
      replies: [],
    });
  });

  for (const reply of (output.replies ?? []).slice(0, 5)) {
    const target = feed.posts.find((p) => p.id === reply.postId) ?? feed.posts.at(-1);
    const body = String(reply.body ?? '').trim();
    if (!target || !body) continue;
    // 返信は必ず親より後、かつ今より前
    const floor = Math.max(new Date(target.at).getTime(), ...target.replies.map((r) => new Date(r.at).getTime()), 0);
    const at = new Date(Math.min(now.getTime() - 60_000, floor + (5 + Math.floor(Math.random() * 90)) * 60_000));
    target.replies.push({ id: nextId('r'), author: known(reply.author), at: at.toISOString(), body: body.slice(0, 300) });
  }

  const target = feed.gatherings.find((g) => g.status === 'upcoming');
  if (target) {
    for (const handle of output.attend ?? []) {
      if (handles.has(handle) && !target.attendees.includes(handle)) target.attendees.push(handle);
    }
  }

  feed.posts.sort((a, b) => (a.at < b.at ? -1 : 1));
  if (feed.posts.length > MAX_POSTS) feed.posts = feed.posts.slice(-MAX_POSTS);
}

/** 今から minutesAgo 分前。ばらけさせるためだけの時刻。 */
function stamp(minutesAgo) {
  return new Date(now.getTime() - minutesAgo * 60_000).toISOString();
}

/** 次の集まりは、これから 3〜9 日後の 21 時。深夜の散歩なので夜に置く。 */
function nextGatheringTime() {
  const at = new Date(now.getTime() + (3 + Math.floor(Math.random() * 7)) * 86_400_000);
  // JST の 21:00 を UTC で置く（12:00Z）
  at.setUTCHours(12, 0, 0, 0);
  return at;
}

function nextId(prefix) {
  const used = new Set([
    ...feed.posts.map((p) => p.id),
    ...feed.posts.flatMap((p) => p.replies.map((r) => r.id)),
    ...feed.gatherings.map((g) => g.id),
  ]);
  let n = 1;
  while (used.has(`${prefix}${`${n}`.padStart(3, '0')}`)) n++;
  return `${prefix}${`${n}`.padStart(3, '0')}`;
}

function jstTime(iso) {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

// ---------------------------------------------------------------- 検査

/** 壊れたものを書き出さない。id の重複と、未来の時刻と、知らない住人を弾く。 */
function validate(feed, residents) {
  const handles = new Set(residents.map((r) => r.handle));
  const ids = new Set();
  const limit = Date.now() + 60_000;
  const seen = (id) => {
    if (ids.has(id)) throw new Error(`id が重複している: ${id}`);
    ids.add(id);
  };
  for (const post of feed.posts) {
    seen(post.id);
    if (!handles.has(post.author)) throw new Error(`知らない住人: ${post.author}`);
    if (new Date(post.at).getTime() > limit) throw new Error(`未来の投稿: ${post.id}`);
    for (const reply of post.replies) {
      seen(reply.id);
      if (!handles.has(reply.author)) throw new Error(`知らない住人: ${reply.author}`);
      if (new Date(reply.at).getTime() > limit) throw new Error(`未来の返信: ${reply.id}`);
    }
  }
  for (const gathering of feed.gatherings) seen(gathering.id);
}
