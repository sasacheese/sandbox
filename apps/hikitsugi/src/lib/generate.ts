/**
 * 引継書を組み立てる。
 *
 * 乱数は外から渡す。同じ申込から毎回同じ書類が出ないと、受け取ったものが
 * 「自分の関係」に見えない（読み直すたびに内容が変わる書類は、書類ではない）。
 * 保存するのは組み立てた結果の方で、この関数は一度しか呼ばれない。
 */

import { COMMUNITY, COMPANIONS, LEAK_TEMPLATES, LOG_LINES, NOTES, type CompanionSeed } from './pools.ts';
import { isoTime, type Belief, type Companion, type Handover, type Intake, type LogEntry, type Pledge } from './types.ts';

export type Rand = () => number;

/** 期間が長いほど、関係が増える。 */
export function companionCount(days: number): number {
  if (days <= 14) return 3;
  if (days <= 30) return 4;
  return 5;
}

function shuffle<T>(list: readonly T[], rand: Rand): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/**
 * 親密度。
 *
 * 期間が長いほど高く、後から関係が始まった相手ほど低い。上限を 95 にしてあるのは、
 * 100 にすると「完成した関係」を渡したことになるから。引き継ぐのは途中の関係。
 */
function closenessOf(days: number, index: number, rand: Rand): number {
  const base = 34 + Math.min(days, 90) * 0.45 - index * 8 + rand() * 8;
  return Math.max(18, Math.min(95, Math.round(base)));
}

function beliefsOf(seed: CompanionSeed, intake: Intake, index: number, rand: Rand): Belief[] {
  const fabricated = shuffle(seed.fabrications, rand)
    .slice(0, index === 0 ? 3 : 2)
    .map((text) => ({ text, fabricated: true }));
  // 本当のことも混ざっている。混ざっているから、どれが嘘か覚えていられない
  const real: Belief[] = index % 2 === 0 ? [{ text: `${intake.interest}に関心があること`, fabricated: false }] : [];
  return shuffle([...fabricated, ...real], rand);
}

export function buildHandover(intake: Intake, now: Date, rand: Rand): Handover {
  const chosen = shuffle(COMPANIONS, rand).slice(0, companionCount(intake.days));

  const companions: Companion[] = chosen.map((seed, index) => ({
    id: seed.id,
    name: seed.name,
    profile: seed.profile,
    calls: seed.callsOf(intake.name),
    closeness: closenessOf(intake.days, index, rand),
    // 最初の相手は初日から。あとの相手は期間の中にばらける
    metDay: index === 0 ? 1 : Math.max(2, Math.floor((intake.days * (index + rand())) / (chosen.length + 1))),
    shared: [...shuffle(seed.topics, rand).slice(0, 2), ...(index === 0 ? [intake.interest] : [])],
    secret: seed.secret,
    beliefs: beliefsOf(seed, intake, index, rand),
    avoid: seed.avoid,
    joke: seed.joke,
  }));

  const pledges: Pledge[] = chosen.map((seed) => ({
    id: `pledge-${seed.id}`,
    to: seed.id,
    body: seed.pledge.body,
    dueDay: seed.pledge.dueDay,
    status: 'pending',
  }));

  const leaked = LEAK_TEMPLATES.map((template) =>
    template({ name: intake.name, interest: intake.interest, habit: intake.habit, avoid: intake.avoid }),
  );

  const log = buildLog(intake.days, companions, intake.name, rand);

  return {
    serial: serialOf(now, rand),
    issuedAt: isoTime(now),
    community: COMMUNITY,
    days: intake.days,
    companions,
    pledges,
    leaked,
    notes: [...NOTES],
    log,
  };
}

/** 代行期間の記録。一日一行。淡々と、業務日誌の書式で。 */
function buildLog(days: number, companions: readonly Companion[], name: string, rand: Rand): LogEntry[] {
  const out: LogEntry[] = [];
  let previous = '';
  for (let day = 1; day <= days; day++) {
    // 同じ行が二日続くと、生成したものだと一目で分かる。一度だけ引き直す
    let line = LOG_LINES[Math.floor(rand() * LOG_LINES.length)] ?? '参加のみ。';
    if (line === previous) line = LOG_LINES[Math.floor(rand() * LOG_LINES.length)] ?? '参加のみ。';
    previous = line;
    // その日までに関係が始まっている相手だけが出てくる
    const available = companions.filter((c) => c.metDay <= day);
    const who = available[Math.floor(rand() * Math.max(1, available.length))];
    out.push({
      day,
      text: line.replace('{who}', who?.name ?? '参加者').replace('{name}', name),
    });
  }
  return out;
}

const SERIAL_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function serialOf(now: Date, rand: Rand): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  let tail = '';
  for (let i = 0; i < 4; i++) tail += SERIAL_CHARS[Math.floor(rand() * SERIAL_CHARS.length)];
  return `HK-${y}${m}${d}-${tail}`;
}

/** 引き継ぎから何日経ったか。期限の判定に使う。 */
export function daysSinceHandover(handover: Handover, now: Date, rate = 1): number {
  const ms = now.getTime() - new Date(handover.issuedAt).getTime();
  return Math.max(0, Math.floor((ms / 86_400_000) * rate));
}
