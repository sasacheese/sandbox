import { closenessLabel, listTime } from '../lib/format.ts';
import { effectiveCloseness } from '../lib/closeness.ts';
import { bubblesOf, daysSinceInherit, elapsedDays, isReady, pendingAsksOf, previewOf, unreadOf } from '../lib/threads.ts';
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
          {kind === 'mine' ? `${threads.length} 件` : store.readyCount > 0 ? `${store.readyCount} 件が引き継ぎ可能` : `${threads.length} 件`}
        </span>
      </header>

      {kind === 'proxy' ? (
        <p className="listhead__lede">
          あなたの代理人が応対しています。交流が満了したものから引き継げます。相手が引き継ぐかどうかは、申し出るまで分かりません。
        </p>
      ) : null}

      <div className="rows">
        {threads.length === 0 ? (
          <div className="empty">
            {kind === 'mine' ? 'トークはまだありません。' : '代理人のトークはありません。'}
          </div>
        ) : null}

        {threads.map((thread) => (
          <Row key={thread.id} thread={thread} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

function Row({ thread, onOpen }: { thread: Thread; onOpen: (threadId: string) => void }) {
  const { now, settings, handoverFor } = useStore();
  const bubbles = bubblesOf(thread, now, settings.dayMs);
  const preview = previewOf(bubbles);
  const unread = unreadOf(thread, bubbles);
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const pending = pendingAsksOf(bubbles);
  const base = handover?.closeness ?? 0;
  const current = thread.decision === 'inherit' ? effectiveCloseness(base, thread.delta, daysSinceInherit(thread, now, settings.dayMs)) : base;
  const closed = thread.decision === 'end' || thread.decision === 'agent_only';

  return (
    <button type="button" className={`row${closed ? ' row--closed' : ''}`} onClick={() => onOpen(thread.id)}>
      {thread.kind === 'proxy' ? (
        <Avatar name={thread.title} inherited={base} current={current} />
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
          {handover && !thread.decision ? <span className="row__dormant">沈黙 {handover.dormant}</span> : null}
          {pending > 0 ? <span className="chip-state chip-state--ask">確認 {pending}</span> : null}
        </div>
      </div>
    </button>
  );
}

function State({ thread, closeness }: { thread: Thread; closeness: number }) {
  const { now, settings } = useStore();
  if (thread.kind === 'plain' && !thread.decision) return null;

  if (thread.decision === 'inherit') {
    return <span className="chip-state">{closeness} · {closenessLabel(closeness)}</span>;
  }
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理人が継続中</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">破棄</span>;
  if (isReady(thread, now, settings.dayMs)) return <span className="chip-state chip-state--ready">引き継ぎ可能</span>;
  return (
    <span className="chip-state">
      交流中 {elapsedDays(thread, now, settings.dayMs)} / {thread.days} 日
    </span>
  );
}
