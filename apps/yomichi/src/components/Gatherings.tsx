import { past, upcoming } from '../lib/feed.ts';
import { dateLabel, gatheringWhen } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';
import { Avatar } from './Avatar.tsx';

/**
 * 集まり。オフラインで実際に会う回。
 *
 * 参加表明はこの端末にしか残らない。人数の表示は「住人の参加者数＋自分」で、
 * 自分が入ると 1 人増える。**その 1 人だけが実在する**。
 */
export function Gatherings() {
  const { feed, attending, toggleAttend, me } = useStore();
  const now = useNow(60_000);
  const next = upcoming(feed, now);
  const done = past(feed, now);

  return (
    <div className="screen">
      <header className="header">
        <span className="header__title">集まり</span>
        <span className="header__sub">{next.length > 0 ? `予定 ${next.length} 件` : '予定なし'}</span>
      </header>

      {next.length === 0 ? <div className="empty">いまのところ予定はありません。</div> : null}

      {next.map((gathering, i) => {
        const going = attending.includes(gathering.id);
        const count = gathering.attendees.length + (going ? 1 : 0);
        return (
          <section className={`gathering${i === 0 ? ' gathering--next' : ''}`} key={gathering.id}>
            <div className="gathering__when">{gatheringWhen(gathering.at)}</div>
            <div className="gathering__place">{gathering.place}</div>
            <div className="gathering__meta">
              {gathering.title} · {gathering.by} が声をかけた
            </div>
            <div className="faces">
              {gathering.attendees.map((handle) => (
                <Avatar key={handle} name={handle} small />
              ))}
              {going && me ? <Avatar name={me.handle} small /> : null}
              <span className="gathering__meta">{count} 人</span>
            </div>
            <button
              type="button"
              className={going ? 'btn btn--ghost btn--wide' : 'btn btn--wide'}
              onClick={() => void toggleAttend(gathering.id)}
            >
              {going ? '行くのをやめる' : '行く'}
            </button>
          </section>
        );
      })}

      {done.length > 0 ? (
        <>
          <div className="section__head">これまで</div>
          <div className="list">
            {done.map((gathering) => (
              <div className="list__row" key={gathering.id}>
                <div className="list__body">
                  <div className="list__title">
                    {dateLabel(gathering.at)} {gathering.place}
                  </div>
                  <div className="list__meta">{gathering.note || gathering.title}</div>
                </div>
                <span className="list__count">{gathering.attendees.length} 人</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
