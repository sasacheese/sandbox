import { hueOf } from '../lib/format.ts';
import { proxyShare, yourScale } from '../lib/timeline.ts';

/**
 * 関係の年表。この作品でいちばん強い一枚。
 *
 * 縦が親密度、横が時間。線は**引継の縦線より前で全部立ち上がりきっている**。
 * 上がっていく区間は茶色（代行）で、そこから先の短い区間だけが黒（あなた）。
 * 読み取ってほしいのは一つだけ——**この山を登ったのは自分ではない**。
 *
 * 縮尺の取り方は Ribbon と共通（lib/timeline.ts）。二つの図が違う割り当てを
 * 使うと、同じ画面で違うことを言い出す。
 */
export type ChartPerson = {
  id: string;
  name: string;
  metDay: number;
  /** 引き継いだ時点の高さ（代行が築いたぶん）。 */
  inherited: number;
  /** 今の高さ。 */
  current: number;
};

const W = 320;
const H = 190;
const PAD = { top: 14, right: 12, bottom: 26, left: 10 };

export function Chart({
  people,
  proxyDays,
  proxyFilled,
  elapsed,
  horizon,
}: {
  people: readonly ChartPerson[];
  proxyDays: number;
  /** 代行中は途中まで描く。引き継ぎ後は proxyDays と同じ。 */
  proxyFilled: number;
  elapsed: number;
  horizon: number;
}) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const SEAM = proxyShare(elapsed, horizon);
  const scale = yourScale(elapsed, horizon);
  const seamX = PAD.left + plotW * SEAM;

  /** 代行期間の日を x へ。0 日目が左端、proxyDays が引継の線。 */
  const xProxy = (day: number): number => PAD.left + (plotW * SEAM * Math.min(day, proxyDays)) / Math.max(1, proxyDays);
  /** 引き継いだあとの日を x へ。 */
  const xYours = (day: number): number => seamX + (plotW * (1 - SEAM) * Math.min(day, scale)) / scale;
  const y = (value: number): number => PAD.top + plotH * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="関係の年表。代行期間に親密度が立ち上がり、引継以降はあなたの区間">
        {/* 目安の横罫。数字は出さない（読ませたいのは高さの推移ではなく、山の位置） */}
        {[0, 25, 50, 75, 100].map((value) => (
          <line key={value} x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} className="chart__grid" />
        ))}

        {/* 代行の区間の地。ここが他人の時間であることを面で示す */}
        <rect x={PAD.left} y={PAD.top} width={plotW * SEAM} height={plotH} className="chart__proxyArea" />

        {people.map((person) => {
          // まだ出会っていない相手は描かない（描くと底に張り付いた線になり、
          // 「関係が無い」ではなく「親密度 0 の関係がある」に見えてしまう）
          if (person.metDay > proxyFilled) return null;
          const hue = hueOf(person.name);
          const stroke = `hsl(${hue} 24% 42%)`;
          const start = xProxy(Math.max(1, person.metDay));
          const peak = xProxy(proxyFilled);
          const grown = (Math.min(proxyFilled, proxyDays) - person.metDay) / Math.max(1, proxyDays - person.metDay);
          const height = person.inherited * Math.max(0, Math.min(1, grown));
          return (
            <g key={person.id}>
              {/* 代行が築いた区間。少し撓ませて、人の手で積まれたようには見せない */}
              <path
                d={`M ${start} ${y(0)} Q ${(start + peak) / 2} ${y(height * 0.45)} ${peak} ${y(height)}`}
                className="chart__proxyLine"
                stroke={stroke}
              />
              <circle cx={start} cy={y(0)} r={2} fill={stroke} />
              {proxyFilled >= proxyDays ? (
                <>
                  {/* 引継の点。ここで持ち主が変わる */}
                  <circle cx={seamX} cy={y(person.inherited)} r={3.4} className="chart__seamDot" />
                  {/* あなたの区間。何もしなければ下がる */}
                  <line x1={seamX} y1={y(person.inherited)} x2={xYours(elapsed)} y2={y(person.current)} className="chart__yoursLine" />
                  <circle cx={xYours(elapsed)} cy={y(person.current)} r={2.4} className="chart__yoursDot" />
                </>
              ) : null}
            </g>
          );
        })}

        {/* 引継の縦線 */}
        <line x1={seamX} y1={PAD.top - 6} x2={seamX} y2={H - PAD.bottom + 4} className="chart__seam" />
        <text x={seamX} y={H - PAD.bottom + 16} className="chart__seamText" textAnchor="middle">
          引継
        </text>
        <text x={PAD.left} y={H - PAD.bottom + 16} className="chart__axisText">
          代行 {proxyDays} 日
        </text>
        <text x={W - PAD.right} y={H - PAD.bottom + 16} className="chart__axisText" textAnchor="end">
          あなた {elapsed > 0 ? `${elapsed} 日` : ''}
        </text>
      </svg>
      <figcaption className="chart__legend">
        <span className="chart__key chart__key--proxy">代行が築いた</span>
        <span className="chart__key chart__key--yours">あなたが維持している</span>
      </figcaption>
    </figure>
  );
}
