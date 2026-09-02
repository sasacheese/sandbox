/**
 * 取り込んだ履歴から、代理のやり取りを作る。
 *
 * 手書きの九人は見本で、**自分の履歴を取り込んだ相手には台本が無い**。ここで
 * 作る。入力は過去ログと自分の表示名だけ——代理が知っていてよいのはそれだけ
 * なので、モデルに渡すのもそれだけ。
 *
 * 鍵は本人が設定に貼ったものを端末に置いて使う。**リポジトリにも配信物にも
 * 入らない。**送る先はモデルの API だけで、こちらのサーバは無い。
 *
 * 返ってきた JSON は厳しく検査する。出どころが「履歴」なのに履歴に無い文を
 * 引いていれば「文体」へ落とし、日付や側が壊れていれば作らない。**壊れた台本
 * で始めるより、無いほうがいい。**
 */

import type { Ask, CounterpartSeed, ScriptLine, Source } from './pools.ts';
import type { Transcript } from './transcript.ts';

export type Api = { key: string; model: string };

export const DEFAULT_MODEL = 'gpt-5.6-terra';

/** 端末に保存できる形。関数を持てないので、呼び方は雛形で持つ。 */
export type StoredSeed = Omit<CounterpartSeed, 'callsOf'> & { callsTemplate: string };

export function hydrateSeed(stored: StoredSeed): CounterpartSeed {
  const { callsTemplate, ...rest } = stored;
  return { ...rest, callsOf: (name) => callsTemplate.replace('{name}', name) };
}

const SOURCES: readonly Source[] = ['history', 'you', 'them', 'style', 'guess'];

function formatLog(transcript: Transcript, own: string): string {
  return transcript.messages
    .map((m) => `${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')}\t${m.mine ? own : transcript.name}\t${m.text.replace(/\n/g, ' ')}`)
    .join('\n');
}

function promptFor(transcript: Transcript, own: string, persona: number): string {
  return `あなたはメッセンジャーの実験機能「代理応答」の台本を作る役です。
以下は「${own}」と「${transcript.name}」の、実際の過去のトーク履歴です。二人はこの後、連絡を取っていません。

--- 過去ログ ---
${formatLog(transcript, own)}
--- ここまで ---

この二人それぞれの「代理（AI）」が、本人の代わりに 90 日間やり取りをします。その台本を JSON で作ってください。

守ること：
- ${own} 側の代理は、過去ログにある ${own} の書き方（長さ・句読点・敬語の度合い・語尾）を真似る。
- ${own} 側の代理が知っているのは過去ログの中身だけ。それより後のことは知らない。知らないことを言うときは source を "guess" にする。
- ${own} 側の発言のうち、過去ログの内容を根拠にしたものは source を "history" にし、from に過去ログの該当する一通の本文をそのまま入れる（改変しない）。
- 事実を言っていない発言（相づち・受け答え）は source を "style" にする。
- ${transcript.name} 側は、相手の代理の発言。過去ログの人物像から自然に続く範囲で、90 日のあいだに一つ重い秘密を打ち明け、一度だけ小さな喧嘩をして仲直りし、内輪の言い回しが一つ生まれ、最後の一往復で「本人が出てきたらこうは話せない」ことを匂わせる。
- 好かれやすさの度合いは ${persona}/100。高いほど ${own} 側の代理は過去ログに無いことも補って話す（そのぶん "guess" が増える）。
- 「代理からの確認」を 2 つ入れる。代理が過去ログでは分からないことを ${own} 本人に訊く問いで、gap には「過去ログに無い」ことが分かる一行を書く。
- 文は短く、平易な日本語で。誇張しない。感嘆符は使わない。

JSON の形（この形以外は出さない。前置きも不要）：
{
  "short": "接点を六文字以内で",
  "relation": "接点の説明を一文で",
  "callsTemplate": "相手が${own}を呼ぶ形。{name} を名前に置き換える。例: {name}さん",
  "secret": "相手が打ち明ける重い秘密（一文）",
  "avoid": "相手に触れてはいけない話題（一文）",
  "joke": { "phrase": "内輪の言い回し（短く）", "meaning": "その意味と経緯（一文）" },
  "fabrications": ["${own}についての作り話 3 つ。「あなたが〜であること」の形"],
  "plans": [{ "body": "一緒に立てた計画", "dueDay": 10 }, { "body": "…", "dueDay": 30 }],
  "tally": { "messages": 400, "secrets": 4, "conflicts": 1 },
  "asks": [
    { "id": "ask-1", "day": 20, "gap": "…より後のことは過去ログにありません", "text": "本人への問い", "onYes": "はいのとき代理が相手へ言うこと", "onNo": "いいえのとき（訂正）", "onGuess": "答えなかったとき代理が埋める言葉（onYes と同じでよい）" },
    { "id": "ask-2", "day": 60, "gap": "…", "text": "…", "onYes": "…", "onNo": "…", "onGuess": "…" }
  ],
  "script": [
    { "day": 2, "side": "yours", "text": "…", "source": "history", "from": "過去ログの一通そのまま" },
    { "day": 2, "side": "theirs", "text": "…" },
    { "day": 6, "side": "theirs", "text": "…" },
    { "day": 6, "side": "yours", "text": "…", "source": "style" }
  ]
}

script は 22〜30 行。day は 1〜90 で単調増加（同じ day が続いてもよい）。side は "yours"（${own} 側の代理）か "theirs"（${transcript.name} 側の代理）。silence を付けると、その行の前に何日か止まったことになる（喧嘩のあとに 3 か 4 を一度だけ）。`;
}

/** モデルは前置きや \`\`\` を付けたがるので、最初の JSON らしき塊だけを取り出す。 */
function parseJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

async function viaResponses(prompt: string, api: Api): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${api.key}` },
    body: JSON.stringify({ model: api.model, input: prompt }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  const data = (await response.json()) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const parts = (data.output ?? []).flatMap((item) => item.content ?? []).map((c) => c.text).filter((t): t is string => typeof t === 'string');
  if (parts.length === 0) throw new Error('応答に本文が無い');
  return parts.join('');
}

async function viaChat(prompt: string, api: Api): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${api.key}` },
    body: JSON.stringify({ model: api.model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('応答に本文が無い');
  return text;
}

/** 新しめのモデルは /v1/responses、それ以外は /v1/chat/completions。順に試す。 */
async function ask(prompt: string, api: Api): Promise<unknown> {
  const errors: string[] = [];
  for (const call of [viaResponses, viaChat]) {
    try {
      const parsed = parseJson(await call(prompt, api));
      if (parsed) return parsed;
      errors.push('JSON として読めなかった');
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(' / '));
}

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * 返ってきたものを台本の形に落とす。壊れていれば null。
 *
 * 出どころが「履歴」なのに履歴に無い文を引いていれば「文体」へ落とす。
 * **引用は、必ず過去ログに実在する一通でなければならない。**
 */
export function validateSeed(raw: unknown, transcript: Transcript, own: string, slot: CounterpartSeed['slot']): StoredSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const texts = new Set(transcript.messages.map((m) => m.text));

  const script: ScriptLine[] = [];
  let lastDay = 0;
  for (const item of Array.isArray(r.script) ? (r.script as Raw[]) : []) {
    const day = Math.max(1, Math.min(90, Math.round(num(item.day, lastDay || 1))));
    const side = item.side === 'yours' || item.side === 'theirs' ? item.side : null;
    const text = str(item.text);
    if (!side || !text) continue;
    let source = SOURCES.includes(item.source as Source) ? (item.source as Source) : undefined;
    let from = str(item.from) || undefined;
    if (source === 'history' && (!from || !texts.has(from))) {
      // 履歴に無い文を引いている。出どころを落とし、引用も捨てる
      const match = from ? [...texts].find((t) => t.includes(from as string) || (from as string).includes(t)) : undefined;
      if (match) from = match;
      else {
        source = 'style';
        from = undefined;
      }
    }
    if (source !== 'history') from = undefined;
    const silence = num(item.silence, 0);
    script.push({
      day: Math.max(day, lastDay),
      side,
      text,
      ...(side === 'yours' && source ? { source } : {}),
      ...(from ? { from } : {}),
      ...(silence > 0 ? { silence: Math.min(7, Math.round(silence)) } : {}),
    });
    lastDay = Math.max(day, lastDay);
  }
  if (script.length < 12 || script.length > 40) return null;
  if (!script.some((l) => l.side === 'yours') || !script.some((l) => l.side === 'theirs')) return null;

  const asks: Ask[] = [];
  for (const item of Array.isArray(r.asks) ? (r.asks as Raw[]).slice(0, 3) : []) {
    const text = str(item.text);
    const onYes = str(item.onYes);
    if (!text || !onYes) continue;
    asks.push({
      id: `${str(item.id, `ask-${asks.length + 1}`)}`,
      day: Math.max(1, Math.min(90, Math.round(num(item.day, 30)))),
      gap: str(item.gap, '過去ログにありません'),
      text,
      onYes,
      onNo: str(item.onNo, 'そうではありません。ただ、聞いています。'),
      onGuess: str(item.onGuess, onYes),
    });
  }

  const joke = (r.joke ?? {}) as Raw;
  const tally = (r.tally ?? {}) as Raw;
  const fabrications = (Array.isArray(r.fabrications) ? r.fabrications : []).map((f) => str(f)).filter(Boolean).slice(0, 3);
  const plans = (Array.isArray(r.plans) ? (r.plans as Raw[]) : [])
    .map((p) => ({ body: str(p.body), dueDay: Math.max(1, Math.round(num(p.dueDay, 14))) }))
    .filter((p) => p.body)
    .slice(0, 3);

  return {
    id: `gen-${idOf(transcript.name)}`,
    name: transcript.name,
    generated: true,
    ...(slot ? { slot } : {}),
    short: str(r.short, '取り込んだ履歴の相手'),
    relation: str(r.relation, `${own} と過去にやり取りがあった相手。`),
    callsTemplate: str(r.callsTemplate, '{name}さん').includes('{name}') ? str(r.callsTemplate, '{name}さん') : '{name}さん',
    secret: str(r.secret, '誰にも言っていないことがある。'),
    avoid: str(r.avoid, '過去ログに出てこない話題。'),
    joke: { phrase: str(joke.phrase, 'また今度'), meaning: str(joke.meaning, '過去ログの最後の言い方から生まれた合図。') },
    fabrications: fabrications.length > 0 ? fabrications : [`あなたが ${transcript.name} との過去のやり取りを覚えていること`],
    plans: plans.length > 0 ? plans : [{ body: '落ち着いたら会う。日付は決めていない。', dueDay: 30 }],
    tally: { messages: Math.round(num(tally.messages, 300)), secrets: Math.round(num(tally.secrets, 3)), conflicts: Math.round(num(tally.conflicts, 1)) },
    asks,
    script,
  };
}

function idOf(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_000_007;
  return hash.toString(36);
}

/**
 * 一人ぶんの台本を作る。一回の呼び出しで全部作り、あとは同じ時間割で流す。
 *
 * `phase` は一周のなかのいまの位置（0..1）。作った瞬間に現れて、そこから
 * 一通ずつ届き始めるようにする。
 */
export async function generateSeed(transcript: Transcript, own: string, persona: number, api: Api, phase: number): Promise<StoredSeed> {
  const raw = await ask(promptFor(transcript, own, persona), api);
  // 間隔は手書きの九人と揃える（15〜21 秒）。名前から決めるので、同じ相手は毎回同じ
  const gap = 0.0088 + (parseInt(idOf(transcript.name), 36) % 5) * 0.0006;
  const days = Math.max(30, Math.min(120, 30 + transcript.messages.length * 6));
  const seed = validateSeed(raw, transcript, own, { at: Math.max(0, Math.min(0.9, phase)), days, gap });
  if (!seed) throw new Error('台本の形が壊れていたので、作りませんでした');
  return seed;
}
