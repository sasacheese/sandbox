/**
 * 期間の帯。全画面の上端に常に出す。
 *
 * この作品でいちばん説明が要る部分——「関係は誰かが数週間から数か月かけて
 * 築いた」「あなたが受け取ったのは、その後ろの短い区間だけ」——を、
 * 文章ではなく**幅の比**で見せる。茶色が代理人、黒があなた。
 *
 * 縮尺の取り方は lib/timeline.ts に切り出してある（年表と同じ割り当てを
 * 使わないと、二つの図が違うことを言い出す）。
 */
import { proxyShare, yourScale } from '../lib/timeline.ts';

export function Ribbon({
  proxyDays,
  proxyFilled,
  elapsed,
  horizon,
}: {
  proxyDays: number;
  /** 交流期間のうち、何日ぶんを塗るか（交流中は途中まで）。 */
  proxyFilled: number;
  /** 引き継いでから経った日数。 */
  elapsed: number;
  /** あなたの側の目安（最後の期限までの日数）。 */
  horizon: number;
}) {
  const proxyRatio = Math.max(0, Math.min(1, proxyFilled / Math.max(1, proxyDays)));
  const share = proxyShare(elapsed, horizon);
  const yourRatio = Math.max(0, Math.min(1, elapsed / yourScale(elapsed, horizon)));

  return (
    <div className="ribbon">
      <div className="ribbon__track">
        <div className="ribbon__proxy" style={{ flexBasis: `${share * 100}%` }}>
          <div className="ribbon__proxyFill" style={{ width: `${proxyRatio * 100}%` }} />
          <span className="ribbon__caption">代理人 {proxyDays} 日</span>
        </div>
        <div className="ribbon__seam" aria-hidden="true" />
        <div className="ribbon__yours">
          <div className="ribbon__yoursFill" style={{ width: `${yourRatio * 100}%` }} />
          <span className="ribbon__caption ribbon__caption--yours">
            {elapsed > 0 ? `あなた ${elapsed} 日` : 'あなた'}
          </span>
        </div>
      </div>
      <div className="ribbon__marks">
        <span>代理人が築いた期間</span>
        <span className="ribbon__seamLabel">引継</span>
        <span>あなたの期間</span>
      </div>
    </div>
  );
}
