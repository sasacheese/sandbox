import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { effectiveCloseness } from '../lib/closeness.ts';
import { clockTime, closenessLabel } from '../lib/format.ts';
import { bubblesOf, daysSinceInherit, isReady, nextPost, storyDay } from '../lib/threads.ts';
import type { AskAnswer, Bubble, Thread } from '../lib/types.ts';
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
  const { now, send, delegate, markRead, answerAsk, handoverFor } = useStore();
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const bubbles = bubblesOf(thread, now);
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const inherited = thread.decision === 'inherit';
  const ready = isReady(thread, now);
  const base = handover?.closeness ?? 0;
  const closeness = inherited ? effectiveCloseness(base, thread.delta, daysSinceInherit(thread, now)) : base;

  /*
   * 次の一通が来る直前の「…」。
   *
   * 台本があるので、次に喋るのがどちら側かは分かっている。隠さずに演出へ回す。
   * これがあると、間が空いているのが「止まっている」ではなく「書いている」に見える。
   */
  const coming = nextPost(thread, now);
  const typing = coming && coming.at - now.getTime() < TYPING_MS ? coming.side : null;

  // 開いたら既読にする。未読の数はここで消える
  useEffect(() => {
    void markRead(thread.id);
  }, [markRead, thread.id, bubbles.length]);

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: bubbles.length > 0 ? 'smooth' : 'auto' });
  }, [bubbles.length, thread.id, typing]);

  /*
   * 出たての一通。
   *
   * 眺めているあいだに届いたものだけ、ふわりと入るようにしてある。開き直した
   * ときに全部が動くと、何が新しいのか分からなくなる。
   */
  const isFresh = (at: string): boolean => now.getTime() - new Date(at).getTime() < FRESH_MS;

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
                  ? '相手側は代理が返事をしています'
                  : '引き継ぎ済み'
                : `代理がやり取り中 · ${ready ? (thread.days ?? 0) : Math.min(storyDay(thread, now), thread.days ?? 0)} / ${thread.days} 日`}
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
              {closeness} / 100　うち {base} は代理
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
          return (
            <Turn
              key={bubble.id}
              bubble={bubble}
              showLabel={newLabel}
              showAgentMark={inherited}
              fresh={isFresh(bubble.at)}
              onAnswer={(answer) => {
                if (bubble.ask) void answerAsk(thread.id, bubble.ask.id, answer);
              }}
            />
          );
        })}

        {typing ? (
          <div className={`bubblerow bubblerow--${typing}`}>
            <div className="typing" aria-label="入力中">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

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
              title="代理に任せる"
              aria-label="代理に任せる"
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
              ? 'このトークは終わりにしました。'
              : thread.decision === 'agent_only'
                ? '代理だけが続けています。あなたは入っていません。'
                : ready
                  ? 'やり取りが終わりました。引継書を読めます。'
                  : '代理がやり取りしています。ここには書き込めません。'}
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

/** 届いてから、出たての印を出しておく長さ。 */
const FRESH_MS = 2_500;

/** 次の一通が来るまで、あと何ミリ秒から「…」を出すか。 */
const TYPING_MS = 3_500;

function Turn({
  bubble,
  showLabel,
  showAgentMark,
  fresh,
  onAnswer,
}: {
  bubble: Bubble;
  showLabel: boolean;
  showAgentMark: boolean;
  fresh: boolean;
  onAnswer: (answer: AskAnswer) => void;
}) {
  return (
    <>
      {bubble.silence ? <div className="silence">（{bubble.silence} 日間、やり取りが止まりました）</div> : null}
      {showLabel ? <div className="daystamp">{bubble.dayLabel}</div> : null}
      {bubble.divider ? <div className="divider">{bubble.divider}</div> : null}
      {bubble.ask ? <Ask ask={bubble.ask} fresh={fresh} onAnswer={onAnswer} /> : null}
      {bubble.ask ? null : (
      <div className={`bubblerow bubblerow--${bubble.side}${fresh ? ' bubblerow--fresh' : ''}`}>
        <div className={`bubble${bubble.byAgent ? ' bubble--agent' : ''}`}>{bubble.text}</div>
        <div className="bubble__meta">
          {bubble.byAgent && showAgentMark ? <span className="agentmark">代</span> : null}
          <span className="bubble__time">{clockTime(bubble.at)}</span>
        </div>
      </div>
      )}
      {bubble.fabricated ? <p className="fabnote">※ これは本当のことではありません</p> : null}
    </>
  );
}

/**
 * 代理人からの確認。
 *
 * 吹き出しではなく、本人へ向いた札として描く。**答えないまま猶予を過ぎると
 * 代理人が埋める**ので、放置も一つの選択になる（そして埋めたぶんが作り話になる）。
 */
function Ask({
  ask,
  fresh,
  onAnswer,
}: {
  ask: NonNullable<Bubble['ask']>;
  fresh: boolean;
  onAnswer: (answer: AskAnswer) => void;
}) {
  const label: Record<AskAnswer, string> = { yes: 'はい', no: 'いいえ', skip: '答えない' };

  return (
    <div className={`askcard${fresh ? ' askcard--fresh' : ''}`}>
      <div className="askcard__head">代理からの確認</div>
      <p className="askcard__text">{ask.text}</p>
      {ask.answered ? (
        <div className="askcard__done">「{label[ask.answered]}」と答えました</div>
      ) : ask.autoFilled ? (
        <div className="askcard__auto">答えなかったので、代理が勝手に答えました</div>
      ) : (
        <div className="askcard__btns">
          <button type="button" className="opt" onClick={() => onAnswer('yes')}>
            はい
          </button>
          <button type="button" className="opt" onClick={() => onAnswer('no')}>
            いいえ
          </button>
          <button type="button" className="opt" onClick={() => onAnswer('skip')}>
            答えない
          </button>
        </div>
      )}
    </div>
  );
}
