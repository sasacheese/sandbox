import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { effectiveCloseness } from '../lib/closeness.ts';
import { clockTime, closenessLabel } from '../lib/format.ts';
import { bubblesOf, daysSinceInherit, elapsedDays, isReady } from '../lib/threads.ts';
import type { Bubble, Thread } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 会話。
 *
 * 代理人のトークも、自分のトークと**同じ吹き出しで**描く。違いは色と、
 * 右下に付く「代」の印だけ。開いた瞬間に自分のトーク画面に見えて、
 * よく見ると自分は一言も打っていない——という順序で気づいてほしい。
 *
 * 入力欄の出し方が三通りある。
 *   自分のトーク　　　：打てる
 *   代理人のトーク　　：打てない。代わりに帯が出る（満了していれば引継書へ）
 *   引き継いだトーク　：打てる。隣に「代理人に任せる」が付く
 */
export function Chat({ thread, onBack, onOpenHandover }: { thread: Thread; onBack: () => void; onOpenHandover: () => void }) {
  const { now, settings, send, delegate, markRead, handoverFor } = useStore();
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const bubbles = bubblesOf(thread, now, settings.dayMs);
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const inherited = thread.decision === 'inherit';
  const ready = isReady(thread, now, settings.dayMs);
  const base = handover?.closeness ?? 0;
  const closeness = inherited ? effectiveCloseness(base, thread.delta, daysSinceInherit(thread, now, settings.dayMs)) : base;

  // 開いたら既読にする。未読の数はここで消える
  useEffect(() => {
    void markRead(thread.id);
  }, [markRead, thread.id, bubbles.length]);

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [bubbles.length, thread.id]);

  let lastLabel = '';

  return (
    <div className="chat">
      <header className="chathead">
        <button type="button" className="chathead__back" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <Avatar name={thread.title} size={34} {...(handover ? { inherited: base, current: closeness } : {})} />
        <div>
          <div className="chathead__title">{thread.title}</div>
          <div className="chathead__sub">
            {thread.kind === 'plain' && !inherited
              ? '自分のトーク'
              : inherited
                ? thread.theirs === 'agent_only'
                  ? '相手は代理人が応対しています'
                  : '引き継ぎ済み'
                : `代理人が応対中 · ${Math.min(elapsedDays(thread, now, settings.dayMs), thread.days ?? 0)} / ${thread.days} 日`}
          </div>
        </div>
      </header>

      {handover ? (
        <div className="closeness">
          <div className="closeness__bar">
            <div className="closeness__proxy" style={{ width: `${Math.min(base, closeness)}%` }} />
            {closeness > base ? <div className="closeness__mine" style={{ width: `${closeness - base}%` }} /> : null}
            {closeness < base ? <div className="closeness__lost" style={{ width: `${base - closeness}%` }} /> : null}
          </div>
          <div className="closeness__row">
            <span>{closenessLabel(closeness)}</span>
            <span>
              {closeness} / 100　代理人が {base} まで築いた
            </span>
          </div>
        </div>
      ) : null}

      <div className="stream">
        {bubbles.length === 0 ? <p className="streamnote">まだやり取りがありません。</p> : null}

        {bubbles.map((bubble) => {
          const newLabel = bubble.dayLabel !== lastLabel;
          lastLabel = bubble.dayLabel;
          /*
           * 「代」の印は、書いた者が混ざるトークにだけ出す。
           *
           * 代理人のトークは全部が代理人の発言なので、一通ごとに印を付けても
           * 情報が増えない（実際、印だらけで読みにくかった）。混ざるのは
           * 引き継いだあとのトークだけ。
           */
          return <Turn key={bubble.id} bubble={bubble} showLabel={newLabel} showAgentMark={inherited} />;
        })}

        {thread.kind === 'plain' && !inherited && thread.sent.length === 0 ? (
          <p className="streamnote">
            最後のやり取りから、ずいぶん経っています。
            <br />
            送っても、すぐには返ってこないかもしれません。
          </p>
        ) : null}

        <div ref={bottom} />
      </div>

      {inherited || thread.kind === 'plain' ? (
        <div className="composer">
          <textarea
            className="composer__input"
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            placeholder="メッセージを入力"
          />
          {inherited ? (
            <button
              type="button"
              className="iconbtn iconbtn--agent"
              title="代理人に任せる"
              aria-label="代理人に任せる"
              onClick={() => void delegate(thread.id)}
            >
              代
            </button>
          ) : null}
          <button
            type="button"
            className="iconbtn"
            disabled={draft.trim() === ''}
            aria-label="送信"
            onClick={() => {
              void send(thread.id, draft);
              setDraft('');
            }}
          >
            ↑
          </button>
        </div>
      ) : (
        <div className="agentbar">
          <span className="agentbar__text">
            {thread.decision === 'end'
              ? 'このトークは破棄されました。'
              : thread.decision === 'agent_only'
                ? '代理人だけが応対しています。あなたは参加していません。'
                : ready
                  ? '交流が満了しました。引継書を読めます。'
                  : 'あなたの代理人が応対しています。ここには書き込めません。'}
          </span>
          {ready ? (
            <button type="button" className="agentbar__btn" onClick={onOpenHandover}>
              引継書を読む
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Turn({ bubble, showLabel, showAgentMark }: { bubble: Bubble; showLabel: boolean; showAgentMark: boolean }) {
  return (
    <>
      {bubble.silence ? <div className="silence">（{bubble.silence} 日間、やり取りが止まりました）</div> : null}
      {showLabel ? <div className="daystamp">{bubble.dayLabel}</div> : null}
      {bubble.divider ? <div className="divider">{bubble.divider}</div> : null}
      <div className={`bubblerow bubblerow--${bubble.side}`}>
        <div className={`bubble${bubble.byAgent ? ' bubble--agent' : ''}`}>{bubble.text}</div>
        <div className="bubble__meta">
          {bubble.byAgent && showAgentMark ? <span className="agentmark">代</span> : null}
          <span className="bubble__time">{clockTime(bubble.at)}</span>
        </div>
      </div>
      {bubble.fabricated ? <p className="fabnote">※ この発言は事実に基づきません</p> : null}
    </>
  );
}
