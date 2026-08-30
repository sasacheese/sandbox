import { since } from '../lib/format.ts';
import { MOOD_LABEL, moodTier } from '../lib/mood.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';
import { Edict } from './Edict.tsx';
import { Report } from './Report.tsx';

/**
 * 指令の画面。
 *
 * 状態は 4 つしかない——指令が降りている／集合時刻を過ぎて報告待ち／
 * 裁定が出た直後／何も無い。「何も無い」を空白のまま見せるのが大事で、
 * ここに埋め草（今日のヒントや participants の一覧）を置くと、
 * 待たされている感じが消えて、運営がただのお知らせ機能になる。
 */
export function Home() {
  const { realm, mood, directives, open, attend, decrees, thinking, me } = useStore();
  // 集合までの残りを秒で出すので、この画面だけ 1 秒ごとに描き直す
  const now = useNow(1000);
  const tier = moodTier(mood);
  const index = directives.length;
  const passed = open ? new Date(open.gatherAt).getTime() <= now.getTime() : false;
  const decided = [...directives]
    .filter((d) => d.verdict)
    .sort((a, b) => ((a.verdict?.at ?? '') < (b.verdict?.at ?? '') ? 1 : -1))[0];
  const lastDecree = [...decrees].sort((a, b) => (a.at < b.at ? 1 : -1))[0];

  return (
    <div className="screen">
      <header className="topbar">
        <span className="realm">{realm.name}</span>
        <span className="label">{me?.name}</span>
      </header>

      <section className="mood">
        <div className="mood__bar">
          <div className="mood__fill" style={{ width: `${mood}%` }} />
        </div>
        <div className="mood__row">
          <span className="mood__text">{MOOD_LABEL[tier]}</span>
          <span className="mood__num">{mood} / 100</span>
        </div>
      </section>

      {realm.stopped ? (
        <div className="empty">
          運営は停止した。
          <br />
          指令はもう降りない。
        </div>
      ) : open ? (
        <>
          <Edict directive={open} now={now} index={index} />
          {open.attendees.length > 0 ? (
            <p className="sub">
              {open.attendees.join('、')} が向かっている{open.attending ? '。あなたも表明済み' : ''}
            </p>
          ) : null}
          {!open.attending ? (
            <button className="btn" type="button" onClick={() => void attend(open.id)}>
              行く
              <span className="btn__hint">ATTEND</span>
            </button>
          ) : null}
          {passed ? <Report directive={open} /> : <p className="sub">集合時刻を過ぎると報告できる。</p>}
        </>
      ) : (
        <>
          <div className="empty">指令はまだ降りていない。</div>
          {decided?.verdict ? (
            <section className="section">
              <div className="label">直近の裁定</div>
              <p className={`oracle${decided.verdict.accepted ? '' : ' oracle--quiet'}`}>{decided.verdict.text}</p>
              <span className="sub">{since(decided.verdict.at, now)}</span>
            </section>
          ) : null}
        </>
      )}

      {lastDecree && !realm.stopped ? (
        <section className="section">
          <div className="label">最後の布告</div>
          <p className="oracle oracle--quiet">{lastDecree.text}</p>
          <span className="sub">{since(lastDecree.at, now)}</span>
        </section>
      ) : null}

      {thinking ? (
        <span className="thinking">
          <span className="thinking__dot" aria-hidden="true" />
          運営が書いている
        </span>
      ) : null}
    </div>
  );
}
