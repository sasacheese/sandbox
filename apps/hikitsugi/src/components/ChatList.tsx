import { closenessLabel, listTime, quietLabel } from '../lib/format.ts';
import { effectiveCloseness } from '../lib/closeness.ts';
import { bubblesOf, daysSinceInherit, isLive, isReady, pendingAsksOf, previewOf, quietDaysOf, storyDay, unreadOf } from '../lib/threads.ts';
import type { Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * トークの一覧。
 *
 * 二つのタブで**同じ書式**を使う。片方は自分が打ったもの、もう片方は代理人が
 * 打ったもの。並べ方も、抜粋も、未読の出し方も変えない。書式が同じだから、
 * 行き来したときに濃さの違いだけが目に入る。
 */
export function ChatList({ kind, onOpen }: { kind: 'mine' | 'proxy'; onOpen: (threadId: string) => void }) {
  const store = useStore();
  const threads = kind === 'mine' ? store.mine : store.proxies;

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">{kind === 'mine' ? 'トーク' : '代理'}</span>
        <span className="listhead__note">
          {kind === 'proxy' ? <Live count={store.proxies.filter((t) => isLive(t, store.now)).length} /> : null}
          {kind === 'mine' ? `${threads.length} 件` : store.readyCount > 0 ? `${store.readyCount} 件引き継げます` : `${threads.length} 件`}
        </span>
      </header>

      {kind === 'proxy' ? (
        <p className="listhead__lede">
          代理があなたの代わりにやり取りしています。やり取りが終わったものから引き継げます。相手が引き継ぐかどうかは、申し出るまで分かりません。
        </p>
      ) : null}

      <div className="rows">
        {threads.length === 0 ? (
          <div className="empty">
            {kind === 'mine' ? 'トークはまだありません。' : '代理のトークはありません。'}
          </div>
        ) : null}

        {threads.map((thread) => (
          <Row key={thread.id} thread={thread} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

/** いま動いている本数。数字の隣で点が脈打つ。 */
function Live({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="live">
      <span className="live__dot" aria-hidden="true" />
      {count} 件やり取り中
    </span>
  );
}

function Row({ thread, onOpen }: { thread: Thread; onOpen: (threadId: string) => void }) {
  const { now, handoverFor } = useStore();
  const bubbles = bubblesOf(thread, now);
  const preview = previewOf(bubbles);
  const unread = unreadOf(thread, bubbles);
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const pending = pendingAsksOf(bubbles);
  const base = handover?.closeness ?? 0;
  const current = thread.decision === 'inherit' ? effectiveCloseness(base, thread.delta, daysSinceInherit(thread, now)) : base;
  const closed = thread.decision === 'end' || thread.decision === 'agent_only';
  // 届いた行が一瞬光る。一覧を出したまま置いておくと、どこが動いたか分かる
  const fresh = preview.at !== null && now.getTime() - new Date(preview.at).getTime() < 2_500;

  return (
    <button type="button" className={`row${closed ? ' row--closed' : ''}${fresh ? ' row--fresh' : ''}`} onClick={() => onOpen(thread.id)}>
      {thread.kind === 'proxy' ? (
        <Avatar name={thread.title} inherited={base} current={current} live={isLive(thread, now)} />
      ) : (
        <Avatar name={thread.title} {...(thread.decision === 'inherit' ? { inherited: base, current } : {})} />
      )}
      <div className="row__body">
        <div className="row__top">
          <span className="row__title">{thread.title}</span>
          <span className="row__time">{listTime(preview.at, now)}</span>
        </div>
        <div className="row__preview">
          {preview.byAgent ? <span className="agentmark">代</span> : null}
          <span className="row__text">{preview.text || 'まだやり取りがありません'}</span>
          {unread > 0 ? <span className="row__badge">{unread > 99 ? '99+' : unread}</span> : null}
        </div>
        <div className="row__preview row__preview--state">
          <State thread={thread} closeness={current} />
          {!thread.decision ? <span className="row__dormant">連絡なし {quietLabel(quietDaysOf(thread, now))}</span> : null}
          {pending > 0 ? <span className="chip-state chip-state--ask">確認 {pending}</span> : null}
        </div>
      </div>
    </button>
  );
}

function State({ thread, closeness }: { thread: Thread; closeness: number }) {
  const { now } = useStore();
  if (thread.kind === 'plain' && !thread.decision) return null;

  if (thread.decision === 'inherit') {
    return <span className="chip-state">{closeness} · {closenessLabel(closeness)}</span>;
  }
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理が続けています</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">終わり</span>;
  if (isReady(thread, now)) return <span className="chip-state chip-state--ready">引き継げます</span>;
  return (
    <span className="chip-state">
      やり取り {storyDay(thread, now)} / {thread.days} 日
    </span>
  );
}
