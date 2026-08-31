import { useEffect, useRef, useState } from 'react';
import { dormantLabel } from '../lib/format.ts';
import { bubblesOf, isLive, isReady, storyDay } from '../lib/threads.ts';
import type { Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 友達一覧。
 *
 * ここが**この作品でいちばん短く言える画面**になる。上の帯に二つの数字が並ぶ。
 *
 *   自分の友達 3　／　代理の友達 9
 *
 * 左の数字は動かない。右の数字は、眺めているあいだに増える。
 *
 * 代理が動いている相手は、顔に**環**（やり取りの進み具合）と「代」の印が付く。
 * 誰と誰が自分の友達で、誰と誰が代理の友達なのかを、文章を読まずに見分けられる。
 */
export function Friends({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { threads, now } = useStore();

  const groups: { key: string; title: string; note?: string; threads: Thread[] }[] = [
    {
      key: 'building',
      title: '代理がやり取りしています',
      note: 'やり取りが終わると引き継げます。',
      threads: threads.filter((t) => t.kind === 'proxy' && !t.decision && !isReady(t, now)),
    },
    {
      key: 'ready',
      title: '引き継ぎを待っています',
      threads: threads.filter((t) => t.kind === 'proxy' && !t.decision && isReady(t, now)),
    },
    {
      key: 'inherited',
      title: '自分で引き継いだ相手',
      threads: threads.filter((t) => t.decision === 'inherit'),
    },
    {
      key: 'yours',
      title: '自分の友達',
      note: '自分でやり取りしている相手です。',
      threads: threads.filter((t) => t.kind === 'plain' && !t.decision),
    },
    {
      key: 'left',
      title: '終わったもの',
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
              自分の友達
            </span>
            <Count value={mine} />
          </div>
          <div className="tally__row">
            <span className="tally__key">
              <span className="tally__dot tally__dot--proxy" aria-hidden="true" />
              代理の友達
            </span>
            <Count value={proxy} />
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

/**
 * 増えるところを見せる数字。
 *
 * 差し替わるだけだと、増えたことに気づかない。左の数字が動かないまま右だけが
 * 上がっていく——そこがこの画面の言いたいことなので、動くところを見せる。
 */
function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (from.current === value) return;
    const start = from.current;
    const at = performance.now();
    let frame = 0;
    const step = () => {
      const ratio = Math.min(1, (performance.now() - at) / 520);
      setShown(Math.round(start + (value - start) * ratio));
      if (ratio < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={`tally__num${shown !== value ? ' tally__num--moving' : ''}`}>{shown}</span>;
}

function Friend({ thread, onOpen }: { thread: Thread; onOpen: (threadId: string) => void }) {
  const { now, handoverFor } = useStore();
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const days = thread.days ?? 0;
  const elapsed = Math.min(storyDay(thread, now), days);
  const progress = days > 0 ? elapsed / days : 0;
  const building = thread.kind === 'proxy' && !thread.decision && !isReady(thread, now);
  const live = isLive(thread, now);

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
      <Avatar name={thread.title} size={42} live={live} {...(thread.kind === 'proxy' ? { progress, mark: '代' } : {})} />
      <div className="friend__body">
        <div className="friend__top">
          <span className="friend__name">{thread.title}</span>
          <State thread={thread} />
        </div>
        <div className="friend__sub">
          {handover ? `${handover.short} · ` : ''}連絡なし {dormant}
        </div>
        {building ? (
          <div className="friend__progress">
            <div className="friend__bar">
              <span className="friend__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="friend__days">
              {live ? <span className="live__dot" aria-hidden="true" /> : null}
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
  if (thread.decision === 'inherit') return <span className="chip-state">自分で返信</span>;
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理が続けています</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">終わり</span>;
  if (thread.kind === 'plain') return <span className="chip-state chip-state--mine">自分で</span>;
  if (isReady(thread, now)) return <span className="chip-state chip-state--ready">引き継げます</span>;
  /*
   * 交流中の行には印を出さない。
   *
   * 見出しにも「代理人が交流しています」と出ているので、行ごとに繰り返しても
   * 情報が増えない。代わりに下の帯（進み具合）が状態を持つ。**満了した行だけが
   * 塗られた印を持つ**ので、引き継げるものが遠目にも拾える。
   */
  return null;
}
