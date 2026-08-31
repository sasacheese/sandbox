import { hueOf, initial } from '../lib/format.ts';

/**
 * 顔。画像は持たせない。
 *
 * 親密度を渡したときだけ環を描く。**茶の弧＝代理人が築いたぶん、墨の弧＝
 * あなたが足したぶん、朱の弧＝失ったぶん。**一覧を眺めただけで、この関係の
 * ほとんどを自分が作っていないことが見える。
 */
export function Avatar({
  name,
  size = 44,
  inherited,
  current,
}: {
  name: string;
  size?: number;
  inherited?: number;
  current?: number;
}) {
  const ringed = inherited !== undefined;
  const stroke = size >= 40 ? 3 : 2.5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

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
    <span className={`avatar${ringed ? ' avatar--ringed' : ''}`} style={{ width: size, height: size }}>
      {ringed ? (
        <svg className="avatar__ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="avatar__rest" />
          {arc(Math.min(base, now), 0, 'avatar__proxy')}
          {gained > 0 ? arc(gained, base, 'avatar__gained') : null}
          {lost > 0 ? arc(lost, now, 'avatar__lost') : null}
        </svg>
      ) : null}
      <span
        className="avatar__face"
        style={{ background: `hsl(${hueOf(name)} 22% 44%)`, fontSize: size >= 40 ? 15 : 12 }}
        aria-hidden="true"
      >
        {initial(name)}
      </span>
    </span>
  );
}
