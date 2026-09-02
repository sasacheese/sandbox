import { hueOf, initial } from '../lib/format.ts';

/**
 * 顔。画像は持たせない。
 *
 * 環を描くのは二通り。
 *
 * - `inherited` / `current` … 親密度。**茶の弧＝代理人が築いたぶん、墨の弧＝
 *   あなたが足したぶん、朱の弧＝失ったぶん。**一覧を眺めただけで、この関係の
 *   ほとんどを自分が作っていないことが見える。
 * - `progress` … 交流期間の進み具合。友達一覧で使う。**環が閉じたら引き継げる。**
 *
 * `mark` を渡すと、顔の右下に小さな印が付く（代理人が仕掛かっている相手の目印）。
 */
export function Avatar({
  name,
  size = 44,
  inherited,
  current,
  progress,
  mark,
  live = false,
  agent = false,
}: {
  name: string;
  size?: number;
  inherited?: number;
  current?: number;
  progress?: number;
  mark?: string;
  /** いまやり取りが動いている。環が脈打つ。 */
  live?: boolean;
  /** 自分の代理。名前の色ではなく藍で塗る。 */
  agent?: boolean;
}) {
  const ringed = inherited !== undefined || progress !== undefined;
  const stroke = size >= 40 ? 3 : 2.5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  const done = progress !== undefined ? Math.max(0, Math.min(1, progress)) : null;
  const base = Math.max(0, Math.min(100, inherited ?? 0)) / 100;
  const now = Math.max(0, Math.min(100, current ?? inherited ?? 0)) / 100;
  const gained = Math.max(0, now - base);
  const lost = Math.max(0, base - now);

  const arc = (fraction: number, offset: number, className: string) => (
    <circle
      cx={c}
      cy={c}
      r={r}
      fill="none"
      strokeWidth={stroke}
      className={className}
      strokeDasharray={`${circumference * fraction} ${circumference}`}
      strokeDashoffset={-circumference * offset}
      transform={`rotate(-90 ${c} ${c})`}
      strokeLinecap="butt"
    />
  );

  return (
    <span className={`avatar${ringed ? ' avatar--ringed' : ''}${live ? ' avatar--live' : ''}`} style={{ width: size, height: size }}>
      {ringed ? (
        <svg className="avatar__ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="avatar__rest" />
          {done !== null ? (
            arc(done, 0, 'avatar__proxy')
          ) : (
            <>
              {arc(Math.min(base, now), 0, 'avatar__proxy')}
              {gained > 0 ? arc(gained, base, 'avatar__gained') : null}
              {lost > 0 ? arc(lost, now, 'avatar__lost') : null}
            </>
          )}
        </svg>
      ) : null}
      <span
        className={`avatar__face${agent ? ' avatar__face--agent' : ''}`}
        style={{ background: `hsl(${hueOf(name)} 22% 44%)`, fontSize: size >= 40 ? 15 : 12 }}
        aria-hidden="true"
      >
        {initial(name)}
      </span>
      {mark ? (
        <span className="avatar__mark" aria-hidden="true">
          {mark}
        </span>
      ) : null}
    </span>
  );
}
