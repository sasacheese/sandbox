import { LOOP_PRESETS } from '../lib/loop.ts';
import { useStore } from '../store.tsx';

/** 設定。作品の外側の都合だけ置く。作り込まない。 */
export function Settings() {
  const { settings, setLoopMs, reset, persistent, intake, threads, loop } = useStore();
  const inherited = threads.filter((t) => t.decision === 'inherit').length;
  const agentSent = threads.reduce((n, t) => n + t.sent.filter((s) => s.byAgent).length, 0);
  const selfSent = threads.reduce((n, t) => n + t.sent.filter((s) => !s.byAgent).length, 0);

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">設定</span>
      </header>

      <div className="pad">
        <section className="section">
          <div className="section__head">
            <span className="section__no">01</span>
            <span className="section__title">一巡の長さ</span>
          </div>
          <div className="choices">
            {LOOP_PRESETS.map((preset) => (
              <button
                key={preset.ms}
                type="button"
                className={`opt${settings.loopMs === preset.ms ? ' opt--on' : ''}`}
                onClick={() => void setLoopMs(preset.ms)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <span className="sub">
            代理人のトークは九本ぶん用意してあり、順に現れて順に満了します。出し切ると最初へ戻り、引き継いだ関係も答えた確認も残りません。
            短くするほど一通あたりの間隔が詰まります。変えると一巡目の頭から始まります。
          </span>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">02</span>
            <span className="section__title">記録</span>
          </div>
          <div className="cover__rows">
            <div className="kv">
              <span className="kv__key">いまの位置</span>
              <span className="kv__value num">
                {loop.index + 1} 巡目 · {Math.floor(loop.phase / 60_000)} / {Math.round(loop.total / 60_000)} 分
              </span>
            </div>
            <div className="kv">
              <span className="kv__key">お名前</span>
              <span className="kv__value">{intake?.name ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="kv__key">引き継いだ関係</span>
              <span className="kv__value num">{inherited} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">自分で送った返信</span>
              <span className="kv__value num">{selfSent} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">代理人に任せた返信</span>
              <span className="kv__value num">{agentSent} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">保存</span>
              <span className="kv__value">{persistent ? 'この端末に保存しています' : '保存できません'}</span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">03</span>
            <span className="section__title">解約</span>
          </div>
          <p className="sub">本サービスに解約はありません。記録の消去のみ可能です。消去しても、相手方の記憶は残ります。</p>
          <button className="btn btn--ghost" type="button" onClick={() => void reset()}>
            すべて消して最初から
          </button>
        </section>
      </div>
    </>
  );
}
