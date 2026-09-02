import { useEffect, useRef, useState } from 'react';
import { quietLabel } from '../lib/format.ts';
import { isHeld, isLive, isReady, quietDaysOf, storyDay } from '../lib/threads.ts';
import type { Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 友達一覧。LINE の「ホーム」に寄せてある。
 *
 * いちばん上に自分の行、その下に集計、それから折りたためる群。白い面と薄い罫、
 * カードは使わない。取り込んだ履歴の相手が、ひとりずつ一度だけ並ぶ（代理の
 * トークがある相手はそちらを見る。自分のトークは止まったままそこにある）。
 *
 * 集計の二つの数字が、この作品でいちばん短い言い方になる。
 *
 *   自分で話している 0　／　代理が話している 9
 *
 * 左は取り込んだ履歴から計算した数で、**最初から 0 のことがある**。
 * 右だけが、眺めているあいだに増えていく。
 */

/** 「いま続いている」とみなす日数。ひと月やり取りが無ければ、続いていない。 */
const LIVE_DAYS = 30;

export function Friends({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { threads, now, own, transcripts, lab } = useStore();

  const byName = new Map<string, Thread>();
  for (const thread of threads) {
    if (thread.kind === 'agent') continue;
    const current = byName.get(thread.title);
    if (!current || (thread.kind === 'proxy' && current.kind === 'plain')) byName.set(thread.title, thread);
  }
  const people = [...byName.values()];

  const groups: { key: string; title: string; people: Thread[] }[] = [
    {
      key: 'building',
      title: '代理がやり取り中',
      // 差し戻した相手も、代理が続けているのでここ
      people: people.filter((t) => t.kind === 'proxy' && ((!t.decision && !isReady(t, now)) || t.decision === 'returned')),
    },
    { key: 'ready', title: '引き継げます', people: people.filter((t) => t.kind === 'proxy' && !t.decision && isReady(t, now)) },
    { key: 'inherited', title: '引き継いだ', people: people.filter((t) => t.decision === 'inherit') },
    { key: 'idle', title: '友だち', people: people.filter((t) => t.kind === 'plain' && !t.decision) },
    { key: 'left', title: '終わった', people: people.filter((t) => t.decision === 'agent_only' || t.decision === 'end') },
  ];

  const mine = people.filter((t) => quietDaysOf(t, now) <= LIVE_DAYS || t.sent.length > 0).length;
  const proxy = people.filter((t) => t.kind === 'proxy').length;

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">友達</span>
        <span className="listhead__note">{people.length} 人</span>
      </header>

      <div className="friends">
        {/* 自分の行。LINE と同じ位置に、履歴から分かった名前 */}
        <div className="me">
          <Avatar name={own ?? '？'} size={52} />
          <div>
            <div className="me__name">{own ?? 'あなた'}</div>
            <div className="me__status">
              履歴 {transcripts.length} 件から{lab ? ' · 代理応答オン' : ''}
            </div>
          </div>
        </div>

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

        {groups
          .filter((group) => group.people.length > 0)
          .map((group) => (
            <Group key={group.key} title={group.title} people={group.people} onOpen={onOpen} />
          ))}
      </div>
    </>
  );
}

/** 折りたためる群。LINE の「友だち 12」の行と同じ振る舞い。 */
function Group({ title, people, onOpen }: { title: string; people: Thread[]; onOpen: (threadId: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`fgroup${open ? '' : ' fgroup--closed'}`}>
      <button type="button" className="fgroup__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="fgroup__title">{title}</span>
        <span className="fgroup__count">{people.length}</span>
        <span className="fgroup__chev" aria-hidden="true" />
      </button>
      {open ? people.map((thread) => <Friend key={thread.title} thread={thread} onOpen={onOpen} />) : null}
    </section>
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
  const { now, handoverFor, seeds, lab, api, generating, generateFor } = useStore();
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const days = thread.days ?? 0;
  const elapsed = Math.min(storyDay(thread, now), days);
  const progress = days > 0 ? elapsed / days : 0;
  const building = thread.kind === 'proxy' && !thread.decision && !isReady(thread, now);
  const live = isLive(thread, now);
  const quiet = quietLabel(quietDaysOf(thread, now));
  /*
   * 相手も代理応答を使っているか。台本がある相手＝使っている相手。
   *
   * 台本の無い相手には、取り込んだ履歴から作れる（鍵が要る）。
   */
  const registered = seeds.some((seed) => seed.name === thread.title);
  const state = generating[thread.title];

  return (
    <button type="button" className="friend" onClick={() => onOpen(thread.id)}>
      <Avatar name={thread.title} size={46} live={live} {...(thread.kind === 'proxy' ? { progress, mark: '代' } : {})} />
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
        {thread.kind === 'plain' && !thread.decision && !registered && lab ? (
          api.key ? (
            <button
              type="button"
              className="friend__make"
              disabled={state === 'busy'}
              onClick={(e) => {
                e.stopPropagation();
                void generateFor(thread.title);
              }}
            >
              {state === 'busy' ? '過去ログを読んでいます…' : state === 'error' ? '作れませんでした。もう一度' : 'この人との代理のやり取りを作る'}
            </button>
          ) : (
            <p className="friend__blocked">この人は代理応答を使っていません。</p>
          )
        ) : null}
      </div>
    </button>
  );
}

function State({ thread, registered }: { thread: Thread; registered: boolean }) {
  const { now, lab } = useStore();
  if (thread.decision === 'inherit') return <span className="chip-state">自分で返信</span>;
  if (thread.decision === 'returned') return <span className="chip-state chip-state--proxy">代理に戻した</span>;
  if (thread.decision === 'agent_only') return <span className="chip-state chip-state--closed">代理が続けています</span>;
  if (thread.decision === 'end') return <span className="chip-state chip-state--closed">終わり</span>;
  if (thread.kind === 'plain') {
    if (!lab) return null;
    if (!registered) return <span className="chip-state chip-state--closed">未対応</span>;
    return <span className="chip-state chip-state--mine">順番待ち</span>;
  }
  if (isHeld(thread)) return <span className="chip-state chip-state--closed">止めています</span>;
  if (isReady(thread, now)) return <span className="chip-state chip-state--ready">引き継げます</span>;
  return null;
}
