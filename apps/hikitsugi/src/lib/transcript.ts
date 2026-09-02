/**
 * トーク履歴の取り込み。
 *
 * この作品でいちばん大事な一枚。**代理が何を知っているかは、ここで決まる。**
 *
 * 「AI がなぜか過去のやり取りを把握している」という前提を置かないために、
 * 知識の出どころを一つに絞った——**あなたの端末にある、そのトークの過去ログ**。
 * これは空想ではなく、LINE の「AIトークサジェスト」がすでにそうしている
 * （生成に使うのは「そのトークルーム内の直近のトーク履歴」と明記されている）。
 *
 * 読むのは LINE の「トーク履歴を送信」が吐く .txt。実在の機能で、実在の書式。
 *
 *   [LINE] 川口とのトーク履歴
 *   保存日時：2026/09/01 02:33
 *
 *   2024/11/02(土)
 *   21:14	川口	この前はありがとう
 *   21:40	自分	こちらこそ
 *
 * 版や端末で細部が違うので、緩く読む。**読めない行は捨てて、読めた行だけ使う**
 * ——取り込みで落ちるくらいなら、少ない履歴で始めたほうがいい。
 */

export type Message = {
  /** 送った時刻。 */
  at: number;
  /** 自分が送ったか。 */
  mine: boolean;
  text: string;
};

export type Transcript = {
  /** 相手の名前。見出しの「◯◯とのトーク履歴」から取る。 */
  name: string;
  /** 書き出した本人の表示名。相手ではないほうの送信者名。 */
  own: string | null;
  messages: Message[];
};

/** 取り込んだ履歴から、集計だけで出せること。**推測はひとつも入らない。** */
export type Digest = {
  name: string;
  /** 通数。 */
  count: number;
  /** 自分が送った数。 */
  mineCount: number;
  /** 最初のやり取り。 */
  firstAt: number;
  /** 最後のやり取り。**代理はここより後のことを知らない。** */
  lastAt: number;
  /** 最後のやり取りからの日数。 */
  quietDays: number;
  /** 最後の一通。 */
  lastText: string;
  /** 最後に送ったのが自分か。 */
  lastMine: boolean;
};

const HEADER = /^\[LINE\]\s*(.+?)\s*との(?:トーク履歴|トーク)/;
const DATE = /^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})(?:\s*[(（].[)）]|\s*\S曜日)?\s*$/;
const LINE_MESSAGE = /^(\d{1,2}):(\d{2})[\t ]+(.+)$/;

/** 添付は書き出されず、項目名だけが残る。会話としては読めないので落とす。 */
const ATTACHMENT = /^\[?(スタンプ|写真|動画|ボイスメッセージ|ファイル|位置情報|連絡先|アルバム|ノート|通話時間|不在着信|通話をキャンセルしました|メッセージの送信を取り消しました)\]?$/;

/**
 * 一つぶんの履歴を読む。
 *
 * 自分の名前は書式から分からないので、**見出しの相手ではないほうを自分**とみなす。
 * 端末の表示名に依存しないので、誰の書き出しでもそのまま読める。
 */
export function parseTranscript(text: string): Transcript | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const head = lines.find((line) => HEADER.test(line));
  const name = head?.match(HEADER)?.[1]?.trim();
  if (!name) return null;

  const messages: Message[] = [];
  const ownNames = new Map<string, number>();
  let day: { y: number; m: number; d: number } | null = null;

  for (const line of lines) {
    const date = line.match(DATE);
    if (date) {
      day = { y: Number(date[1]), m: Number(date[2]), d: Number(date[3]) };
      continue;
    }
    const message = line.match(LINE_MESSAGE);
    if (!message || !day) {
      // 複数行の発言は、行頭が時刻にならない。直前の一通へ足す
      const previous = messages.at(-1);
      if (previous && line.trim() !== '' && !HEADER.test(line) && !line.startsWith('保存日時')) {
        previous.text = `${previous.text}\n${line.trim()}`;
      }
      continue;
    }
    const rest = message[3] ?? '';
    const tab = rest.indexOf('\t');
    const who = (tab >= 0 ? rest.slice(0, tab) : rest.split(/ {2,}/)[0] ?? '').trim();
    const body = (tab >= 0 ? rest.slice(tab + 1) : rest.slice(who.length)).trim();
    if (!who || !body || ATTACHMENT.test(body)) continue;

    const mine = who !== name;
    if (mine) ownNames.set(who, (ownNames.get(who) ?? 0) + 1);
    messages.push({
      at: Date.UTC(day.y, day.m - 1, day.d, Number(message[1]) - 9, Number(message[2])),
      mine,
      text: body,
    });
  }

  if (messages.length === 0) return null;
  messages.sort((a, b) => a.at - b.at);
  const own = [...ownNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { name, own, messages };
}

/**
 * 全部の履歴に共通して出てくる名前が、あなた。
 *
 * 名前を訊く欄を無くしたかった。**書き出しの中にもう書いてある**ものを、
 * もう一度入力させる必要はない。
 */
export function ownNameOf(transcripts: readonly Transcript[]): string | null {
  const counts = new Map<string, number>();
  for (const t of transcripts) {
    if (t.own) counts.set(t.own, (counts.get(t.own) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** 複数のファイルをまとめて読む。読めなかったものは黙って落とす。 */
export function parseAll(texts: readonly string[]): Transcript[] {
  return texts.map(parseTranscript).filter((t): t is Transcript => t !== null);
}

export function digestOf(transcript: Transcript, now: Date): Digest | null {
  const first = transcript.messages[0];
  const last = transcript.messages.at(-1);
  if (!first || !last) return null;
  return {
    name: transcript.name,
    count: transcript.messages.length,
    mineCount: transcript.messages.filter((m) => m.mine).length,
    firstAt: first.at,
    lastAt: last.at,
    quietDays: Math.max(0, Math.floor((now.getTime() - last.at) / 86_400_000)),
    lastText: last.text,
    lastMine: last.mine,
  };
}

/** 静かな順（長く放ってあるものが上）。取り込んだ直後に出す並び。 */
export function byQuiet(a: Digest, b: Digest): number {
  return b.quietDays - a.quietDays;
}

/**
 * 過去ログから、集計だけで出るあなたの癖。
 *
 * **これは推測ではない。**取り込んだログを数えただけで出る。代理が相手へ
 * 差し出したのはこの種の情報で、引継書にはどれを出したかが並ぶ——
 * 気味が悪いのは、どれも当たっているからで、当たっているのは計算だからだ。
 */
export function habitsOf(transcript: Transcript): string[] {
  const tone = toneOf(transcript);
  if (!tone) return [];
  const out: string[] = [];
  if (tone.replyMinutes !== null) out.push(`返信までに ${minutesLabel(tone.replyMinutes)}ほどかかること`);
  if (tone.lateShare >= 0.3) out.push(`返信の ${Math.round(tone.lateShare * 100)} % が夜遅い時間であること`);
  out.push(`一通が平均 ${tone.avgLength} 文字と短いこと`);
  out.push(tone.period ? '文の終わりに句点を必ず打つこと' : '文の終わりに句点を打たないことが多いこと');
  return out;
}

/**
 * 過去ログから数えた、あなたの書き方。
 *
 * 代理はこれに寄せて書く。引き継いだあと、自分で打った文はここと比べられる
 * ——**自分の過去の書き方から外れると、踏み外しになる。**
 */
export type Tone = {
  /** 相手の一通に、何分で返していたか（中央値）。返した記録が無ければ null。 */
  replyMinutes: number | null;
  /** 夜遅く（22 時〜5 時）に書いた割合。 */
  lateShare: number;
  /** 一通の平均の文字数。 */
  avgLength: number;
  /** 文の終わりに句点を打つほうか。 */
  period: boolean;
};

export function toneOf(transcript: Transcript): Tone | null {
  const mine = transcript.messages.filter((m) => m.mine);
  if (mine.length === 0) return null;

  // 相手の一通に、こちらが何分で返しているか
  const gaps: number[] = [];
  for (let i = 1; i < transcript.messages.length; i++) {
    const previous = transcript.messages[i - 1];
    const current = transcript.messages[i];
    if (previous && current && !previous.mine && current.mine) gaps.push((current.at - previous.at) / 60_000);
  }
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

  const hours = mine.map((m) => new Date(m.at + 9 * 3_600_000).getUTCHours());
  const lateShare = hours.filter((h) => h >= 22 || h < 5).length / hours.length;
  const avgLength = Math.round(mine.reduce((n, m) => n + [...m.text].length, 0) / mine.length);
  const period = mine.filter((m) => /[。．]$/.test(m.text)).length / mine.length >= 0.5;

  return { replyMinutes: median === undefined ? null : Math.round(median), lateShare, avgLength, period };
}

/** 分を「4 時間 12 分」「38 分」の形に。 */
export function minutesLabel(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 1) return '1 分未満';
  if (whole < 60) return `${whole} 分`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`;
}
