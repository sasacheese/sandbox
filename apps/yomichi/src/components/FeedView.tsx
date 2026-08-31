import { useEffect, useMemo, useState } from 'react';
import { threads, upcoming } from '../lib/feed.ts';
import { gatheringWhen, since } from '../lib/format.ts';
import { applyUpdate, subscribeUpdate, updateReady } from '../lib/updates.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';
import { Composer } from './Composer.tsx';
import { PostCard } from './PostCard.tsx';

/**
 * 流れ。開くたびに進んでいる。
 *
 * 先頭に「次の集まり」を一行だけ出す。集まりの画面は別にあるが、
 * 予定があることは流れを見ているだけで目に入ってほしい。
 */
export function FeedView({ onOpenGatherings }: { onOpenGatherings: () => void }) {
  const { feed, me, posts, replies } = useStore();
  const now = useNow(60_000);
  const [, bump] = useState(0);
  // アプリ本体の更新は流れの先頭に出す。設定の奥に置くと押されない
  useEffect(() => subscribeUpdate(() => bump((n) => n + 1)), []);
  const list = useMemo(
    () => (me ? threads(feed, { handle: me.handle, posts, replies }) : []),
    [feed, me, posts, replies],
  );
  const next = upcoming(feed, now)[0] ?? null;

  return (
    <div className="screen">
      <header className="header">
        <span className="header__title">よみち</span>
        <span className="header__sub">最終更新 {since(feed.generatedAt, now)}</span>
      </header>

      {updateReady() ? (
        <button type="button" className="notice" style={{ textAlign: 'left' }} onClick={applyUpdate}>
          新しい版があります。押すと読み込み直します。
        </button>
      ) : null}

      {next ? (
        <button type="button" className="notice" style={{ textAlign: 'left' }} onClick={onOpenGatherings}>
          次の集まり · {gatheringWhen(next.at)} · {next.place}（{next.attendees.length} 人）
        </button>
      ) : null}

      <Composer />

      {list.map((thread) => (
        <PostCard key={thread.id} thread={thread} now={now} />
      ))}
    </div>
  );
}
