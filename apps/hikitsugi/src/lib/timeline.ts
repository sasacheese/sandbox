/**
 * 図の横幅の割り当て。
 *
 * 実日数の比で描くと、代理人 90 日に対して引き継ぎ直後の 0 日は幅ゼロになり、
 * 「あなたの期間」という枠が画面から消える。逆に本人が長く持ち続けると、
 * 今度は代理人の区間が潰れて、**築いたのは他人**という肝心の読みが消える。
 *
 * なので、あなたの側に「約束の最後の期限まで」という枠をあらかじめ取り、
 * その枠を越えたぶんだけ、代行側の幅を正直に譲る。図が守るべき順序は
 * 　1. 引き継ぎ直後：代行が大きい（実際そうなので）
 * 　2. 長く持ったあと：あなたの側が伸びる（これも実際そう）
 * で、どちらのときも嘘にならない縮尺にしてある。
 */

/** 代理人の区間に割り当てる横幅の割合。 */
export function proxyShare(elapsed: number, horizon: number): number {
  if (elapsed <= horizon) return 0.68;
  return Math.max(0.3, 0.68 * (horizon / elapsed));
}

/** あなたの区間の目盛りの上限。期限を越えたら、経過そのものを目盛りにする。 */
export function yourScale(elapsed: number, horizon: number): number {
  return Math.max(1, horizon, elapsed);
}
