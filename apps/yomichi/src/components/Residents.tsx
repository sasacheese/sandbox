import { residents } from '../lib/feed.ts';
import { dateLabel, since } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';
import { Avatar } from './Avatar.tsx';

/**
 * 住人一覧。投稿数の多い順。
 *
 * 自分も同じ表に並ぶ。ここがこの作品でいちばん静かに効く画面で、
 * 自分の数字が桁違いに小さいことに、説明なしで気づく。
 */
export function Residents() {
  const { feed, me, posts, replies } = useStore();
  const now = useNow(60_000);
  if (!me) return null;

  const lastMine = [...posts, ...replies].map((p) => p.at).sort().at(-1) ?? null;
  const list = residents(feed, {
    handle: me.handle,
    joinedAt: me.joinedAt,
    posts: posts.length + replies.length,
    lastAt: lastMine,
  });

  return (
    <div className="screen">
      <header className="header">
        <span className="header__title">住人</span>
        <span className="header__sub">{list.length} 人</span>
      </header>

      <div className="list">
        {list.map((resident) => (
          <div className="list__row" key={resident.handle}>
            <Avatar name={resident.handle} />
            <div className="list__body">
              <div className="list__title">
                {resident.handle} {resident.me ? <span className="tag">あなた</span> : null}
              </div>
              <div className="list__meta">
                {resident.bio || `${dateLabel(resident.joinedAt)} から`}
                {resident.lastAt ? ` · 最後の書き込み ${since(resident.lastAt, now)}` : ''}
              </div>
            </div>
            <span className="list__count">{resident.posts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
