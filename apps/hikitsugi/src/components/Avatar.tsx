import { hueOf, initial } from '../lib/format.ts';

/**
 * 顔。ただの丸ではなく、**環に持ち主を書き込む**。
 *
 * 茶色の弧＝代理人が築いたぶん、黒い弧＝あなたが足したぶん、赤い弧＝失ったぶん。
 * 一覧を眺めただけで「この関係のほとんどは自分が作っていない」が見える。
 */
export function Avatar({
  name,
  small = false,
  inherited,
  current,
}: {
  name: string;
  small?: boolean;
  /** 引き継いだ時点の親密度。省略すると環を描かない。 */
  inherited?: number;
  current?: number;
}) {
  const size = small ? 26 : 40;
  const stroke = small ? 2.5 : 3;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  const hue = hueOf(name);
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
    <span className={`avatar${small ? ' avatar--sm' : ''}`} style={{ width: size, height: size }}>
      {inherited === undefined ? null : (
        <svg className="avatar__ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="avatar__rest" />
          {arc(Math.min(base, now), 0, 'avatar__proxy')}
          {gained > 0 ? arc(gained, base, 'avatar__gained') : null}
          {lost > 0 ? arc(lost, now, 'avatar__lost') : null}
        </svg>
      )}
      <span className="avatar__face" style={{ background: `hsl(${hue} 24% 42%)` }} aria-hidden="true">
        {initial(name)}
      </span>
    </span>
  );
}
