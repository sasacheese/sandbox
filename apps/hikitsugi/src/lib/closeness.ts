/**
 * 親密度の現在値。
 *
 * 三つの足し合わせで決まる。
 *
 * 1. **代行が築いたぶん**（引継書に書かれた値）
 * 2. **あなたの応答**（覚えていれば少し上がり、忘れれば下がる）
 * 3. **放置したぶん**（引き継いでから経った日数だけ、じわじわ下がる）
 *
 * 3 を入れているのは、渡されたのが資産ではなく**維持する義務**だと、
 * 数字と図の両方で見えるようにするため。何もしなければ線は下がっていく。
 * 落ち方は一日 0.6——ひと月放っておくと 18 下がる程度で、気づいたときには
 * 手遅れになっている、という速さに合わせてある。
 */

export const DECAY_PER_DAY = 0.6;

export function effectiveCloseness(base: number, delta: number, elapsedDays: number): number {
  const decayed = base + delta - elapsedDays * DECAY_PER_DAY;
  return Math.max(0, Math.min(100, Math.round(decayed)));
}

/** 代行が築いたぶんだけの値（引き継いだ時点の高さ）。図の茶色の部分に使う。 */
export function inheritedCloseness(base: number): number {
  return Math.max(0, Math.min(100, Math.round(base)));
}
