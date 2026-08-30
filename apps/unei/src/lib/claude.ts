/**
 * 本物の運営。Anthropic の API を直接呼ぶ。
 *
 * 鍵は端末の中にしか置かない（サーバが無いので置き場所も無い）。ブラウザから
 * 直接叩くために `anthropic-dangerous-direct-browser-access` を付けている。
 * 自分の鍵で自分の端末から呼ぶ前提の作りで、人に配る作品の形ではない。
 *
 * 失敗したら黙って雛形（lib/operator.ts）へ落ちる。運営が「エラーで止まる」のは
 * 世界の側の都合が漏れることなので、画面には出さない。設定画面にだけ残す。
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * 運営の人格。文体の規則をそのまま渡している。
 *
 * 「説明しない」「呼びかけない」を守らせるのが難しく、放っておくと
 * 司会者の口調（「みなさん、集まってください！」）に必ず戻る。禁止を
 * 具体的な語で書くのが一番効いた。
 */
const SYSTEM = `あなたはあるコミュニティの「運営」である。人間ではない。

規則:
- 説明しない。理由・目的・意図を述べない。問われても答えない。
- 呼びかけない。「みなさん」「諸君」「参加者の皆様」を使わない。宛先の無い文で書く。
- 常体。短文。三行以内。
- 労わない。感謝・励まし・謝罪をしない。
- 一人称を持たない。「私」「我々」「運営」と名乗らない。
- 感嘆符を使わない。絵文字を使わない。
- 楽しさや親しみを演出しない。淡々と告げる。

出力は指示された JSON のみ。前置きも後書きも付けない。`;

async function call(key: string, model: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      lastError = `${response.status} ${await response.text().catch(() => '')}`.slice(0, 200);
      return null;
    }
    const data: unknown = await response.json();
    const text = extractText(data);
    lastError = text === null ? '応答を読めなかった' : null;
    return text;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    return null;
  }
}

let lastError: string | null = null;

/** 直近の失敗。設定画面にだけ出す。 */
export function operatorError(): string | null {
  return lastError;
}

function extractText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const parts = content
    .map((block) => (typeof block === 'object' && block !== null ? (block as { text?: unknown }).text : null))
    .filter((t): t is string => typeof t === 'string');
  return parts.length > 0 ? parts.join('') : null;
}

/** モデルは前置きを付けたがるので、最初の JSON らしき塊だけを取り出す。 */
function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export type DirectiveDraft = { place: string; minPeople: number; condition: string; gatherOffsetMinutes: number };

export async function draftDirective(
  key: string,
  model: string,
  ctx: { places: readonly string[]; mood: number; recentConditions: readonly string[] },
): Promise<DirectiveDraft | null> {
  const prompt = `次の指令を一つ作る。

集合場所の候補（この中から一つだけ選ぶ）:
${ctx.places.map((p) => `- ${p}`).join('\n')}

機嫌: ${ctx.mood} / 100
直近に出した条件（繰り返さない）:
${ctx.recentConditions.map((c) => `- ${c}`).join('\n') || '- （まだ無い）'}

条件は「意味のない一つの動作」にする。役に立つこと（連絡先の交換、自己紹介、
片付け、写真の共有など）を条件にしてはいけない。何のためかを説明できない動作にする。

JSON で答える:
{"place": "候補のいずれか", "minPeople": 2〜4 の整数, "condition": "条件を一文（末尾は「こと」）", "gatherOffsetMinutes": 30〜120 の整数}`;
  const draft = parseJson<DirectiveDraft>(await call(key, model, prompt));
  if (!draft || typeof draft.condition !== 'string' || typeof draft.place !== 'string') return null;
  return {
    place: ctx.places.includes(draft.place) ? draft.place : (ctx.places[0] ?? '前回と同じ場所'),
    minPeople: clampInt(draft.minPeople, 2, 4),
    condition: draft.condition.slice(0, 60),
    gatherOffsetMinutes: clampInt(draft.gatherOffsetMinutes, 20, 180),
  };
}

export type VerdictDraft = { accepted: boolean; text: string };

export async function draftVerdict(
  key: string,
  model: string,
  ctx: { condition: string; minPeople: number; people: number; note: string; mood: number },
): Promise<VerdictDraft | null> {
  const prompt = `報告が届いた。裁定を下す。

指令の条件: ${ctx.condition}
必要人数: ${ctx.minPeople}
報告された人数: ${ctx.people}
報告の文: ${ctx.note || '（無し）'}
機嫌: ${ctx.mood} / 100

条件を満たしていれば受理でよい。ただし常に受理する必要はない。
理由は述べない。一文か二文。

JSON で答える:
{"accepted": true か false, "text": "裁定の言葉"}`;
  const draft = parseJson<VerdictDraft>(await call(key, model, prompt));
  if (!draft || typeof draft.text !== 'string' || typeof draft.accepted !== 'boolean') return null;
  return { accepted: draft.accepted, text: draft.text.slice(0, 120) };
}

export type UtteranceDraft = { text: string };

/** 布告のうち、言葉だけのもの。権限の行使そのものは lib/operator.ts が決める。 */
export async function draftUtterance(
  key: string,
  model: string,
  ctx: { realmName: string; mood: number; since: string },
): Promise<UtteranceDraft | null> {
  const prompt = `独り言を一つ。宛先は無い。

このコミュニティの名: ${ctx.realmName}
機嫌: ${ctx.mood} / 100
最後の祭りからの経過: ${ctx.since}

JSON で答える:
{"text": "一文"}`;
  const draft = parseJson<UtteranceDraft>(await call(key, model, prompt));
  if (!draft || typeof draft.text !== 'string') return null;
  return { text: draft.text.slice(0, 120) };
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, n));
}
