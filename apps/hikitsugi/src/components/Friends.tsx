import { dormantLabel } from '../lib/format.ts';
import { bubblesOf, storyDay, isReady } from '../lib/threads.ts';
import type { Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 友達一覧。
 *
 * ここが**この作品でいちばん短く言える画面**になる。上の帯に二つの数字が並ぶ。
 *
 *   あなたが築いた 3　／　代理人が築いた 9
 *
 * 左の数字は動かない。右の数字は、眺めているあいだに増える。
 *
 * 代理人が仕掛かっている相手は、顔に**茶の環**（交流期間の進み具合）と
 * 「代」の印が付く。誰と誰が自分の友達で、誰と誰が代理人の友達なのかを、
 * 文章を読まずに見分けられるようにしてある。
 */
export function Friends({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { threads, now } = useStore();

  const groups: { key: string; title: string; note?: string; threads: Thread[] }[] = [
    {
      key: 'building',
      title: '代理人が交流しています',
      note: '満了すると引き継げます。',
      threads: threads.filter((t) => t.kind === 'proxy' && !t.decision && !isReady(t, now)),
    },
    {
      key: 'ready',
      title: '引き継ぎを待っています',
      threads: threads.filter((t) => t.kind === 'proxy' && !t.decision && isReady(t, now)),
    },
    {
      key: 'inherited',
      title: 'あなたが引き継ぎました',
      threads: threads.filter((t) => t.decision === 'inherit'),
    },
    {
      key: 'yours',
      title: 'あなたの友達',
      note: '自分で築いた関係です。',
      threads: threads.filter((t) => t.kind === 'plain' && !t.decision),
    },
    {
      key: 'left',
      title: '手を離れたもの',
      threads: threads.filter((t) => t.decision === 'agent_only' || t.decision === 'end'),
    },
  ];

  const mine = threads.filter((t) => t.kind === 'plain').length;
  const proxy = threads.filter((t) => t.kind === 'proxy').length;

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">友達</span>
        <span className="listhead__note">{mine + proxy} 人</span>
      </header>

      <div className="tally">
        <div className="tally__bar">
          <span className="tally__mine" style={{ flexGrow: mine }} />
          <span className="tally__proxy" style={{ flexGrow: proxy }} />
        </div>
        <div className="tally__rows">
          <div className="tally__row">
            <span className="tally__key">
              <span className="tally__dot tally__dot--mine" aria-hidden="true" />
              あなたが築いた
            </span>
            <span className="tally__num">{mine}</span>
          </div>
          <div className="tally__row">
            <span className="tally__key">
              <span className="tally__dot tally__dot--proxy" aria-hidden="true" />
              代理人が築いた
            </span>
            <span className="tally__num">{proxy}</span>
          </div>
        </div>
      </div>

      <div className="rows">
        {groups
          .filter((group) => group.threads.length > 0)
          .map((group) => (
            <section key={group.key} className="fgroup">
              <div className="fgroup__head">
                <span className="fgroup__title">{group.title}</span>
                <span className="fgroup__count">{group.threads.length}</span>
              </div>
              {group.note ? <p className="fgroup__note">{group.note}</p> : null}
              {group.threads.map((thread) => (
                <Friend key={thread.id} thread={thread} onOpen={onOpen} />
              ))}
            </section>
          ))}
      </div>
    </>
  );
}

function Friend({ thread, onOpen }: { thread: Thread; onOpen: (threadId: string) => void }) {
  const { now, handoverFor } = useStore();
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const days = thread.days ?? 0;
  const elapsed = Math.min(storyDay(thread, now), days);
  const progress = days > 0 ? elapsed / days : 0;
  const building = thread.kind === 'proxy' && !thread.decision && !isReady(thread, now);

  /*
   * 沈黙の長さ。
   *
   * 代理人の相手は引継書の値（本人同士が何年黙っているか）を、自分の友達は
   * 最後のやり取りからの実際の経過を出す。**同じ行に同じ書式で並ぶ**ので、
   * 代理人が三か月で作った関係と、自分が五年ぶり手つかずの関係が見比べられる。
   */
  const last = bubblesOf(thread, now).at(-1);
  const dormant = handover?.dormant ?? (last ? dormantLabel(now.getTime() - new Date(last.at).getTime()) : '—');

  return (
    <button type="button" className="friend" onClick={() => onOpen(thread.id)}>
      <Avatar
        name={thread.title}
        size={40}
        {...(thread.kind === 'proxy' ? { progress, mark: '代' } : {})}
      />
      <div className="friend__body">
        <div className="friend__top">
          <span className="friend__name">{thread.title}</span>
          <State thread={thread} />
        </div>
        <div className="friend__sub">
          {handover ? `${handover.short} · ` : ''}沈黙 {dormant}
        </div>
        {building ? (
          <div className="friend__progress">
            <div className="friend__bar">
              <span className="friend__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="friend__days">
              {elapsed} / {days} 日
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

function State({ thread }: { thread: Thread }) {
  const { now } = useStore();
  if (thread.decision === 'inherit') return <span className="chip-state">あなたが応対</span>;
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理人が継続</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">破棄</span>;
  if (thread.kind === 'plain') return <span className="chip-state chip-state--mine">自分で</span>;
  if (isReady(thread, now)) return <span className="chip-state chip-state--ready">引き継ぎ可能</span>;
  /*
   * 交流中の行には印を出さない。
   *
   * 見出しにも「代理人が交流しています」と出ているので、行ごとに繰り返しても
   * 情報が増えない。代わりに下の帯（進み具合）が状態を持つ。**満了した行だけが
   * 塗られた印を持つ**ので、引き継げるものが遠目にも拾える。
   */
  return null;
}
