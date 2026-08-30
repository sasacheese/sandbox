import { since } from '../lib/format.ts';
import { STOP_DELAY_HOURS } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';

/**
 * 掟と、停止要求。
 *
 * 掟は運営が書き換える。人間の側から編集する手立ては用意していない
 * （読むだけの画面に編集の導線が無いことが、そのまま権限の説明になる）。
 *
 * 停止だけは人間にできる。ただし即座には効かない。止められるが、すぐには
 * 止まらない——この待ち時間そのものが儀式になる、という設計。
 */
export function Laws() {
  const { realm, requestStop, withdrawStop, settings } = useStore();
  const now = useNow(30_000);
  const requested = realm.stopRequestedAt;
  const remainHours = requested
    ? Math.max(0, STOP_DELAY_HOURS - ((now.getTime() - new Date(requested).getTime()) / 3_600_000) * settings.rate)
    : null;

  return (
    <div className="screen">
      <header className="topbar">
        <span className="realm">掟</span>
        <span className="label">{realm.laws.length} 条</span>
      </header>

      {realm.laws.length === 0 ? (
        <div className="empty">掟は無い。</div>
      ) : (
        <div className="laws">
          {realm.laws.map((law, i) => (
            <div className="law" key={law}>
              <span className="law__no">{`${i + 1}`.padStart(2, '0')}</span>
              <span>{law}</span>
            </div>
          ))}
        </div>
      )}

      {realm.silenced.length > 0 ? (
        <section className="section">
          <div className="label">沈黙</div>
          <p className="oracle oracle--quiet">{realm.silenced.join('、')} は話すことができない。</p>
        </section>
      ) : null}

      <section className="section">
        <div className="label">停止</div>
        {realm.stopped ? (
          <p className="oracle oracle--quiet">運営は停止した。</p>
        ) : requested ? (
          <>
            <div className="notice">
              <div className="notice__title">Stop requested</div>
              停止要求は受理された。実行まで残り {remainHours !== null ? remainHours.toFixed(1) : '—'} 時間。
              その間も運営は動く。
            </div>
            <span className="sub">要求 {since(requested, now)}</span>
            <button className="btn btn--quiet" type="button" onClick={() => void withdrawStop()}>
              要求を取り下げる
            </button>
          </>
        ) : (
          <>
            <p className="sub">
              停止を要求できる。要求から実行までは {STOP_DELAY_HOURS} 時間かかる。その間も指令は降りる。
            </p>
            <button className="btn btn--ghost" type="button" onClick={() => void requestStop()}>
              停止を要求する
            </button>
          </>
        )}
      </section>
    </div>
  );
}
