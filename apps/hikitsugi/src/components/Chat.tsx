import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SOURCE_LABEL } from '../lib/pools.ts';
import { effectiveCloseness } from '../lib/closeness.ts';
import { DRAFT_LABEL } from '../lib/draft.ts';
import { clockTime, closenessLabel } from '../lib/format.ts';
import { bubblesOf, daysSinceInherit, isHeld, isReady, nextPost, storyDay } from '../lib/threads.ts';
import { FEEL_LABEL } from '../lib/agent.ts';
import type { AskAnswer, Bubble, FeelingAnswer, Thread } from '../lib/types.ts';
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
  const { now, send, draftFor, delegate, markRead, checkHuman, revert, answerAsk, answerFeeling, handoverFor, tellAgent, own } = useStore();
  const [draft, setDraft] = useState('');
  const [reverting, setReverting] = useState(false);
  const suggestion = draftFor(thread.id);
  /*
   * 出どころの表示。**既定では隠してある。**
   *
   * 本物の製品なら、こんなものは既定で出さない。押せば出る場所にはある、
   * というのが実際に起きる形だと思う。押した瞬間に、会話が札で埋まる。
   */
  const [sources, setSources] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const bubbles = bubblesOf(thread, now);
  const handover = thread.kind === 'proxy' ? handoverFor(thread.id) : null;
  const inherited = thread.decision === 'inherit';
  const ready = isReady(thread, now);
  const base = handover?.closeness ?? 0;
  // 差し戻したあとも、下がったぶんはそのまま（戻した時点で止まる）
  const closeness = inherited || thread.decision === 'returned' ? effectiveCloseness(base, thread.delta, daysSinceInherit(thread, now)) : base;

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
        <Avatar name={thread.kind === 'agent' ? own ?? '？' : thread.title} size={34} clone={thread.kind === 'agent'} {...(handover ? { inherited: base, current: closeness } : {})} />
        <div className="chathead__body">
          <div className="chathead__title">{thread.kind === 'agent' ? `${own ?? 'あなた'}（代理）` : thread.title}</div>
          <div className="chathead__sub">
            {thread.kind === 'agent'
              ? 'あなたのフリをして連絡する役。分からないことはここで訊いてくる'
              : isHeld(thread)
                ? 'あなたの指示で止めています'
              : thread.kind === 'plain' && !inherited
              ? '自分のトーク'
              : inherited
                ? '引き継ぎ済み'
                : thread.decision === 'returned'
                  ? '代理に戻しました'
                : `代理がやり取り中 · ${ready ? (thread.days ?? 0) : Math.min(storyDay(thread, now), thread.days ?? 0)} / ${thread.days} 日`}
          </div>
        </div>
        {thread.kind === 'proxy' ? (
          <button
            type="button"
            className={`sourcebtn${sources ? ' sourcebtn--on' : ''}`}
            onClick={() => setSources((on) => !on)}
            aria-pressed={sources}
          >
            出所
          </button>
        ) : null}
      </header>

      {/*
        代理が何を読んだか。**知識の範囲をここで打ち切る。**
        「なぜか知っている」を消すために、いちばん上に置いてある。
      */}
      {thread.kind === 'proxy' && thread.history.length > 0 ? (
        <div className="knowledge">
          <span className="knowledge__key">代理が読んだもの</span>
          <span className="knowledge__value">
            このトークの過去ログ {thread.history.length} 通（〜{new Date(thread.history.at(-1)?.at ?? 0).toLocaleDateString('ja-JP')}）
          </span>
          <span className="knowledge__note">これより後のことは知りません。</span>
        </div>
      ) : null}

      {/*
        引き継いだあとの象限。**あなたは人間。相手は分からない。**
        訊けば「はい、本人です」と返る。それだけで、確かめようはない。
      */}
      {inherited ? (
        <div className="quadrant">
          <span className="quadrant__cell">
            <span className="quadrant__key">あなた</span>
            <span className="quadrant__value">人間</span>
          </span>
          <span className="quadrant__cell">
            <span className="quadrant__key">相手</span>
            <span className="quadrant__value quadrant__value--unknown">？</span>
          </span>
          <button type="button" className="quadrant__ask" onClick={() => void checkHuman(thread.id)}>
            相手は本人ですか？
          </button>
          {/* 差し戻し。押すと一度だけ確かめて、それから代理に返す。近さは戻らない */}
          <button type="button" className="quadrant__ask" onClick={() => setReverting(true)}>
            やっぱり代理に戻す
          </button>
          {reverting ? (
            <div className="revert">
              <span className="revert__text">代理タブへ戻り、代理が続きを打ちます。自分で書いたぶんは残ります。近さは戻りません。</span>
              <div className="revert__btns">
                <button
                  type="button"
                  className="opt opt--on"
                  onClick={() => {
                    setReverting(false);
                    void revert(thread.id);
                  }}
                >
                  戻す
                </button>
                <button type="button" className="opt" onClick={() => setReverting(false)}>
                  やめる
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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
              showAgentMark={inherited || thread.decision === 'returned'}
              fresh={isFresh(bubble.at)}
              showSource={sources}
              onAnswer={(answer) => {
                // 代理とのトークに出した確認は、相手のトークの札と同じもの
                if (bubble.ask) void answerAsk(bubble.ask.threadId ?? thread.id, bubble.ask.id, answer);
              }}
              onFeel={(answer) => {
                if (bubble.poll) void answerFeeling(bubble.poll.threadId, answer);
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

      {inherited || thread.kind === 'plain' || thread.kind === 'agent' ? (
        <div className="composer">
          {/*
            代理の下書き。**代理ならこう打った**を、入力欄の上にグレーで置く。
            触れば入力欄に入る。無視して自分で打ってもいい——下書きで送れば近さは
            保たれ、自分で打てば下がる。
          */}
          {suggestion && draft.trim() !== suggestion ? (
            <button type="button" className="draftrow" onClick={() => setDraft(suggestion)}>
              <span className="draftrow__key">{DRAFT_LABEL}</span>
              <span className="draftrow__text">{suggestion}</span>
            </button>
          ) : null}
          <textarea
            className="composer__input"
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            placeholder={thread.kind === 'agent' ? '例：菅野さんにはもう送らないで' : 'メッセージを入力'}
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
              if (thread.kind === 'agent') void tellAgent(draft);
              // 下書きをそのまま送ったかどうかは、文が一致するかで見る
              else void send(thread.id, draft, { draft: suggestion !== null && draft.trim() === suggestion });
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
                : thread.decision === 'returned'
                  ? '代理に戻しました。代理が続きを打っています。近さは戻りません。'
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
  showSource,
  onAnswer,
  onFeel,
}: {
  bubble: Bubble;
  showLabel: boolean;
  showAgentMark: boolean;
  fresh: boolean;
  showSource: boolean;
  onAnswer: (answer: AskAnswer) => void;
  onFeel: (answer: FeelingAnswer) => void;
}) {
  // 開示。法律で決まっているので、必ず最初に立つ
  if (bubble.system) return <div className="sysline">{bubble.system}</div>;

  return (
    <>
      {bubble.silence ? <div className="silence">（{bubble.silence} 日間、やり取りが止まりました）</div> : null}
      {showLabel ? <div className="daystamp">{bubble.dayLabel}</div> : null}
      {bubble.divider ? <div className="divider">{bubble.divider}</div> : null}
      {bubble.ask ? <Ask ask={bubble.ask} fresh={fresh} casual={bubble.ask.threadId !== undefined} onAnswer={onAnswer} /> : null}
      {bubble.poll ? <Poll text={bubble.text} answered={bubble.poll.answered} fresh={fresh} onAnswer={onFeel} /> : null}
      {bubble.ask || bubble.poll ? null : (
      <div className={`bubblerow bubblerow--${bubble.side}${fresh ? ' bubblerow--fresh' : ''}`}>
        {/* 相手側が人間か代理か分からない一通は、白でも薄藍でもない色にする */}
        <div className={`bubble${bubble.byAgent ? ' bubble--agent' : ''}${bubble.unknown ? ' bubble--unknown' : ''}`}>{bubble.text}</div>
        <div className="bubble__meta">
          {/* 下書きをそのまま送ったものにも「代」が付く。打ったのはあなた、書いたのは代理 */}
          {(bubble.byAgent || bubble.draft) && showAgentMark ? <span className="agentmark">代</span> : null}
          <span className="bubble__time">{clockTime(bubble.at)}</span>
        </div>
      </div>
      )}
      {bubble.slips && bubble.slips.length > 0 ? (
        <div className="slips">
          {bubble.slips.map((slip) => (
            <div className="slip" key={slip.label}>
              <span className="slip__label">{slip.label}</span>
              <span className="slip__detail">{slip.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
      {showSource && bubble.source && !bubble.ask ? (
        <div className={`srcrow srcrow--${bubble.side}`}>
          <span className={`src src--${bubble.source}`}>{SOURCE_LABEL[bubble.source]}</span>
          {bubble.from ? <span className="src__from">「{bubble.from}」から</span> : null}
        </div>
      ) : null}
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
  casual = false,
  onAnswer,
}: {
  ask: NonNullable<Bubble['ask']>;
  fresh: boolean;
  /** 代理とのトークに出ている札。友達の口調なので見出しも変える。 */
  casual?: boolean;
  onAnswer: (answer: AskAnswer) => void;
}) {
  const label: Record<AskAnswer, string> = { yes: 'はい', no: 'いいえ', guess: casual ? 'まかせる' : '代理にまかせる' };

  return (
    <div className={`askcard${fresh ? ' askcard--fresh' : ''}${casual ? ' askcard--casual' : ''}`}>
      <div className="askcard__head">{casual ? 'これ、どうする？' : '代理からの確認'}</div>
      {/* 何が足りないのかを先に出す。**過去ログに無いから訊いている** */}
      {ask.gap ? <div className="askcard__gap">{ask.gap}</div> : null}
      <p className="askcard__text">{ask.text}</p>
      {ask.answered ? (
        <div className="askcard__done">「{label[ask.answered]}」と答えました</div>
      ) : ask.autoFilled ? (
        <div className="askcard__auto">{casual ? '返事がなかったから、勝手に言った' : '答えなかったので、代理が埋めました'}</div>
      ) : (
        <div className="askcard__btns">
          <button type="button" className="opt" onClick={() => onAnswer('yes')}>
            はい
          </button>
          <button type="button" className="opt" onClick={() => onAnswer('no')}>
            いいえ
          </button>
          <button type="button" className="opt" onClick={() => onAnswer('guess')}>
            代理にまかせる
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 「引き継げた感じ、する？」
 *
 * 代理とのトークにだけ出る。三つのうちどれを選んでも代理は「そう」と言う。
 * **作品は判定を持たない。**答えだけが残って、設定の記録から見返せる。
 */
function Poll({
  text,
  answered,
  fresh,
  onAnswer,
}: {
  text: string;
  answered: FeelingAnswer | undefined;
  fresh: boolean;
  onAnswer: (answer: FeelingAnswer) => void;
}) {
  return (
    <div className={`askcard askcard--casual${fresh ? ' askcard--fresh' : ''}`}>
      <p className="askcard__text">{text}</p>
      {answered ? (
        <div className="askcard__done">「{FEEL_LABEL[answered]}」と答えました</div>
      ) : (
        <div className="askcard__btns">
          {(['yes', 'notyet', 'unsure'] as const).map((answer) => (
            <button type="button" className="opt" key={answer} onClick={() => onAnswer(answer)}>
              {FEEL_LABEL[answer]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
