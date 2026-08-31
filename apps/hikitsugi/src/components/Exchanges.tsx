import type { Exchange } from '../lib/types.ts';

/**
 * 代理人同士のやり取り。この作品の主役。
 *
 * 相性スコアを前に出すとマッチングサービスに見えるので、いちばん大きな面積を
 * ここに割いている。読ませたいのは数字ではなく、**二つの代理人のあいだに
 * 実際に溜まったもの**——打ち明け、沈黙、喧嘩、仲直り、約束。
 *
 * 作り話には、その場で注記を出す。あとで一覧にするより、会話を読んでいる
 * 途中で「※ この発言は事実に基づきません」と挟まるほうが寒い。
 */
export function Exchanges({ exchanges, alias, limit }: { exchanges: readonly Exchange[]; alias: string; limit?: number | undefined }) {
  const shown = limit === undefined ? exchanges : exchanges.slice(0, limit);
  let lastDay = -1;

  return (
    <div className="log">
      {shown.map((exchange, index) => {
        const newDay = exchange.day !== lastDay;
        lastDay = exchange.day;
        return (
          <div key={`${exchange.day}-${index}`}>
            {exchange.silence ? <div className="log__silence">（{exchange.silence} 日間、やり取りが止まりました）</div> : null}
            {newDay ? <div className="log__day">{exchange.day} 日目</div> : null}
            <div className={`turn turn--${exchange.side}`}>
              <span className="turn__who">{exchange.side === 'yours' ? 'あなたの代理人' : alias}</span>
              <p className="turn__text">{exchange.text}</p>
              {exchange.fabricated ? <p className="turn__note">※ この発言は事実に基づきません</p> : null}
            </div>
          </div>
        );
      })}
      {limit !== undefined && exchanges.length > limit ? (
        <div className="log__more">ほか {exchanges.length - limit} 件</div>
      ) : null}
    </div>
  );
}
