/**
 * 親密度の現在値。
 *
 * 三つの足し合わせで決まる。
 *
 * 1. **代理人が築いたぶん**（引継書に書かれた値）
 * 2. **あなたの応答**（覚えていれば少し上がり、忘れれば下がる）
 * 3. **放置したぶん**（引き継いでから経った日数だけ、じわじわ下がる）
 *
 * 3 を入れているのは、渡されたのが資産ではなく**維持する義務**だと、
 * 数字と図の両方で見えるようにするため。何もしなければ線は下がっていく。
 * 落ち方は一日 0.6——ひと月放っておくと 18 下がる程度で、気づいたときには
 * 手遅れになっている、という速さに合わせてある。
 */

export const DECAY_PER_DAY = 0.6;

/**
 * 引き継いだあと、自分で打つと下がるぶん。
 *
 * 代理の下書きをそのまま送れば下がらない。自分で打つと下がり、**引継書の作法
 * から外れた数だけ、さらに下がる**——代理のほうが上手いのは、作法を守るからだ。
 */
export const SELF_SEND_DROP = 8;
export const SLIP_DROP = 3;

export function dropFor(slips: number): number {
  return SELF_SEND_DROP + SLIP_DROP * Math.max(0, slips);
}

/**
 * 代理人同士の親密度。
 *
 * 人間相手の関係より高く出る。代理人は返信が早く、相手の話を忘れず、
 * いつでも都合がつく。**人間には勝てない条件で築かれた関係**を引き継ぐ
 * ことになる、というのがこの数字の意味。上限は 95。
 */
export function closenessOf(days: number, persona: number, rand: () => number): number {
  const base = 48 + Math.min(days, 90) * 0.24 + persona * 0.16 + rand() * 6;
  return Math.max(40, Math.min(95, Math.round(base)));
}

export function effectiveCloseness(base: number, delta: number, elapsedDays: number): number {
  const decayed = base + delta - elapsedDays * DECAY_PER_DAY;
  return Math.max(0, Math.min(100, Math.round(decayed)));
}

/** 代理人が築いたぶんだけの値（引き継いだ時点の高さ）。図の茶色の部分に使う。 */
export function inheritedCloseness(base: number): number {
  return Math.max(0, Math.min(100, Math.round(base)));
}
