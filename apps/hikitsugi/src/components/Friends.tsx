import { useEffect, useRef, useState } from 'react';
import { quietLabel } from '../lib/format.ts';
import { seedOfName } from '../lib/pools.ts';
import { isLive, isReady, quietDaysOf, storyDay } from '../lib/threads.ts';
import type { Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 友達一覧。
 *
 * 取り込んだ履歴の相手が、ひとりずつ一度だけ並ぶ。**同じ人が二回出ないように**、
 * 代理のトークがある相手はそちらを見る（自分のトークは止まったままそこにある）。
 *
 * 上の帯に出る二つの数字が、この作品でいちばん短い言い方になる。
 *
 *   自分で話している 0　／　代理が話している 9
 *
 * 左は取り込んだ履歴から計算した数で、**最初から 0 のことがある**。
 * 右だけが、眺めているあいだに増えていく。
 */

/** 「いま続いている」とみなす日数。ひと月やり取りが無ければ、続いていない。 */
const LIVE_DAYS = 30;

export function Friends({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { threads, now } = useStore();

  /*
   * 相手ごとに一件へまとめる。代理が動いているならそちらを見る。
   */
  const byName = new Map<string, Thread>();
  for (const thread of threads) {
    const current = byName.get(thread.title);
    if (!current || (thread.kind === 'proxy' && current.kind === 'plain')) byName.set(thread.title, thread);
  }
  const people = [...byName.values()];

  const groups: { key: string; title: string; note?: string; people: Thread[] }[] = [
    {
      key: 'building',
      title: '代理がやり取りしています',
      note: 'やり取りが終わると引き継げます。',
      people: people.filter((t) => t.kind === 'proxy' && !t.decision && !isReady(t, now)),
    },
    { key: 'ready', title: '引き継ぎを待っています', people: people.filter((t) => t.kind === 'proxy' && !t.decision && isReady(t, now)) },
    { key: 'inherited', title: '自分で引き継いだ相手', people: people.filter((t) => t.decision === 'inherit') },
    {
      key: 'idle',
      title: '止まったまま',
      note: '最後のやり取りから時間が経っています。',
      people: people.filter((t) => t.kind === 'plain' && !t.decision),
    },
    { key: 'left', title: '終わったもの', people: people.filter((t) => t.decision === 'agent_only' || t.decision === 'end') },
  ];

  /*
   * 自分で話している数。
   *
   * **取り込んだ履歴から計算しているだけ。**自分で一通送れば増える。
   */
  const mine = people.filter((t) => quietDaysOf(t, now) <= LIVE_DAYS || t.sent.length > 0).length;
  const proxy = people.filter((t) => t.kind === 'proxy').length;

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">友達</span>
        <span className="listhead__note">{people.length} 人</span>
      </header>

      <div className="tally">
        <div className="tally__bar">
          <span className="tally__mine" style={{ flexGrow: mine }} />
          <span className="tally__proxy" style={{ flexGrow: proxy }} />
          {mine + proxy === 0 ? <span className="tally__none" /> : null}
        </div>
        <div className="tally__rows">
          <div className="tally__row">
            <span className="tally__key">
              <span className="tally__dot tally__dot--mine" aria-hidden="true" />
              自分で話している
            </span>
            <Count value={mine} />
          </div>
          <div className="tally__row">
            <span className="tally__key">
              <span className="tally__dot tally__dot--proxy" aria-hidden="true" />
              代理が話している
            </span>
            <Count value={proxy} />
          </div>
        </div>
        <p className="tally__note">
          {people.length} 人のうち、この {LIVE_DAYS} 日にあなたが自分でやり取りしたのは {mine} 人です。
        </p>
      </div>

      <div className="rows">
        {groups
          .filter((group) => group.people.length > 0)
          .map((group) => (
            <section key={group.key} className="fgroup">
              <div className="fgroup__head">
                <span className="fgroup__title">{group.title}</span>
                <span className="fgroup__count">{group.people.length}</span>
              </div>
              {group.note ? <p className="fgroup__note">{group.note}</p> : null}
              {group.people.map((thread) => (
                <Friend key={thread.title} thread={thread} onOpen={onOpen} />
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
 * 差し替わるだけだと、増えたことに気づかない。左が動かないまま右だけが
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
  const quiet = quietLabel(quietDaysOf(thread, now));
  /*
   * 相手も代理応答を使っているか。
   *
   * **使っていない相手には、代理を出せない。**両側が要る、というのは実際に
   * そうなるはずのところで、いちばん会いたい人ほど使っていない。
   */
  const registered = seedOfName(thread.title) !== undefined;

  return (
    <button type="button" className="friend" onClick={() => onOpen(thread.id)}>
      <Avatar name={thread.title} size={42} live={live} {...(thread.kind === 'proxy' ? { progress, mark: '代' } : {})} />
      <div className="friend__body">
        <div className="friend__top">
          <span className="friend__name">{thread.title}</span>
          <State thread={thread} registered={registered} />
        </div>
        <div className="friend__sub">
          {handover ? `${handover.short} · ` : ''}連絡なし {quiet}
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
        {thread.kind === 'plain' && !thread.decision && !registered ? (
          <p className="friend__blocked">この人は代理応答を使っていません。招待するまで代理は出せません。</p>
        ) : null}
      </div>
    </button>
  );
}

function State({ thread, registered }: { thread: Thread; registered: boolean }) {
  const { now, lab } = useStore();
  if (thread.decision === 'inherit') return <span className="chip-state">自分で返信</span>;
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理が続けています</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">終わり</span>;
  if (thread.kind === 'plain') {
    if (!registered) return <span className="chip-state chip-state--closed">未対応</span>;
    return <span className="chip-state chip-state--mine">{lab ? '順番待ち' : '自分で'}</span>;
  }
  if (isReady(thread, now)) return <span className="chip-state chip-state--ready">引き継げます</span>;
  return null;
}
