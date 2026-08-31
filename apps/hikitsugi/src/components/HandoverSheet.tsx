import { useState } from 'react';
import { SOURCE_LABEL } from '../lib/pools.ts';
import { closenessLabel, dateLabel, quietLabel } from '../lib/format.ts';
import type { Belief, Decision, Handover, TheirDecision } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';
import { Chart } from './Chart.tsx';
import { DayGrid } from './DayGrid.tsx';
import { Ribbon } from './Ribbon.tsx';

const THEIR_LABEL: Record<TheirDecision, string> = {
  inherit: '相手も引き継ぎました',
  refuse: '相手は引き継ぎませんでした',
  agent_only: '相手は代理にまかせました',
};

/**
 * 引継書。代理人のトークから開く。
 *
 * 会話そのものはトークで読めるので、この書類は**関係を項目に分解したもの**に
 * 絞ってある。分解できるものとして扱った瞬間、それは引き継げる資産になる、
 * というのがこの書式の言い分。
 *
 * 判断のあと、相手側の判断が開く。**相手の答えは、こちらが考え始める前から
 * 決まっていた。**氏名が開くのは、双方が引き継いだときだけ。
 */
export function HandoverSheet({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const { handoverFor, decide, threads } = useStore();
  const handover = handoverFor(threadId);
  const thread = threads.find((t) => t.id === threadId);
  const [confirm, setConfirm] = useState<Decision | null>(null);
  const [done, setDone] = useState(false);

  if (!handover || !thread) return null;

  if (done || thread.decision) {
    return <ResultSheet handover={handover} decision={thread.decision ?? 'inherit'} onClose={onClose} />;
  }

  return (
    <div className="sheet">
      <div className="sheet__inner">
        <header className="sheet__head">
          <span className="sheet__title">関係引継書</span>
          <span className="sheet__no">{handover.serial}</span>
          <button type="button" className="sheet__close" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="pad">
          <Ribbon proxyDays={handover.days} proxyFilled={handover.days} elapsed={0} horizon={14} />

          <section className="cover">
            <div className="cover__title">
              あなたの代理に、
              <br />
              友達ができました。
            </div>

            <Chart
              people={[{ id: handover.threadId, name: handover.name, metDay: 1, inherited: handover.closeness, current: handover.closeness }]}
              proxyDays={handover.days}
              proxyFilled={handover.days}
              elapsed={0}
              horizon={14}
            />

            <div className="cover__rows">
              <div className="kv">
                <span className="kv__key">相手</span>
                <span className="kv__value">{handover.name}</span>
              </div>
              <div className="kv">
                <span className="kv__key">接点</span>
                <span className="kv__value">{handover.short}</span>
              </div>
              <div className="kv">
                <span className="kv__key">本人同士の連絡なし</span>
                <span className="kv__value">{quietLabel(handover.quietDays)}</span>
              </div>
              <div className="kv">
                <span className="kv__key">やり取りした期間</span>
                <span className="kv__value" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {handover.days} 日
                  <DayGrid days={handover.days} filled={handover.days} />
                </span>
              </div>
              <div className="kv">
                <span className="kv__key">やり取り</span>
                <span className="kv__value num">{handover.tally.messages.toLocaleString('en-US')} 件</span>
              </div>
              <div className="kv">
                <span className="kv__key">打ち明けられたこと</span>
                <span className="kv__value num">{handover.tally.secrets} 件</span>
              </div>
              <div className="kv">
                <span className="kv__key">仲直りしたけんか</span>
                <span className="kv__value num">{handover.tally.conflicts} 件</span>
              </div>
              <div className="kv">
                <span className="kv__key">友達にならなかった相手</span>
                <span className="kv__value num">{handover.tally.otherAgents} 人の代理人</span>
              </div>
              <div className="kv">
                <span className="kv__key">発行日</span>
                <span className="kv__value">{dateLabel(new Date().toISOString())}</span>
              </div>
            </div>
            <div className="seal">
              <div className="seal__main">未受領</div>
              <div className="seal__sub">{handover.serial}</div>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__no">01</span>
              <span className="section__title">引き継ぐ関係</span>
            </div>
            <article className="person">
              <div className="person__head">
                <Avatar name={handover.name} inherited={handover.closeness} current={handover.closeness} />
                <span className="person__name">{handover.name}</span>
                <span className="person__calls">
                  あなたの呼び方
                  <strong>{handover.calls}</strong>
                </span>
              </div>

              <p className="sub">{handover.relation}</p>

              <div className="meter">
                <div className="meter__bar">
                  <div className="meter__proxy" style={{ width: `${handover.closeness}%` }} />
                </div>
                <div className="meter__row">
                  <span>{closenessLabel(handover.closeness)}</span>
                  <span>うち {handover.closeness} は代理</span>
                </div>
              </div>

              <div className="field">
                <span className="field__key">相手があなたに打ち明けたこと</span>
                <p className="field__value">{handover.secret}</p>
              </div>

              <div className="field">
                <span className="field__key">相手があなたについて信じていること</span>
                {/* 一行ずつ出どころが付く。**推測の行だけが作り話** */}
                <div className="beliefs">
                  {handover.beliefs.map((belief) => (
                    <Line belief={belief} key={belief.text} />
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field__key">触れてはいけないこと</span>
                <p className="field__value">{handover.avoid}</p>
              </div>

              <div className="field">
                <span className="field__key">内輪の言い回し</span>
                <p className="field__value">
                  「{handover.joke.phrase}」——{handover.joke.meaning}
                </p>
              </div>
            </article>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__no">02</span>
              <span className="section__title">一緒に立てた計画</span>
            </div>
            <div className="plans">
              {handover.plans.map((plan) => (
                <div className="plan" key={plan}>
                  {plan}
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__no">03</span>
              <span className="section__title">代理が外へ出した情報</span>
            </div>
            <p className="sub">
              相手と親しくなるために、以下をあなたのこととして伝えました。
              <br />
              最後の一件を除いて、どれも過去ログを数えれば出るものです。
            </p>
            <div className="beliefs">
              {handover.shared.map((belief) => (
                <Line belief={belief} key={belief.text} />
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__no">04</span>
              <span className="section__title">注意事項</span>
            </div>
            <div className="notes">
              {handover.notes.map((note, i) => (
                <div className="note" key={note}>
                  <span className="note__no">{`${i + 1}`.padStart(2, '0')}</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__no">05</span>
              <span className="section__title">この友情をどうしますか</span>
            </div>

            <div className="decisions">
              <Choice
                title="この友情を引き継ぐ"
                body="以後は自分で返事をします。トークが「トーク」へ移ります。相手が自分で返事をするかどうかは、決めたあとに分かります。"
                on={confirm === 'inherit'}
                onClick={() => setConfirm('inherit')}
              />
              <Choice
                title="代理だけに続けさせる"
                body="あなたはこのやり取りに入りません。週に一度、代理からの報告だけがそのトークに届きます。"
                on={confirm === 'agent_only'}
                onClick={() => setConfirm('agent_only')}
              />
              <Choice
                title="このまま終わりにする"
                body="このやり取りは無くなります。相手には知らされません。"
                on={confirm === 'end'}
                onClick={() => setConfirm('end')}
              />
            </div>

            {confirm ? (
              <>
                <div className="notice">
                  {confirm === 'inherit'
                    ? '引き継ぎを申し込みます。相手の判断は、この引継書が出た時点で決まっています。'
                    : confirm === 'agent_only'
                      ? 'あなたはこの関係の当事者になりません。取り消せません。'
                      : 'このやり取りを無くします。取り消せません。'}
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    void decide(threadId, confirm);
                    setDone(true);
                  }}
                >
                  確定する
                  <span className="btn__hint">CONFIRM</span>
                </button>
                <button className="btn btn--quiet" type="button" onClick={() => setConfirm(null)}>
                  やめる
                </button>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function Choice({ title, body, on, onClick }: { title: string; body: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`decision${on ? ' decision--on' : ''}`} onClick={onClick}>
      <span className="decision__title">{title}</span>
      <span className="decision__body">{body}</span>
    </button>
  );
}

/** 判断のあと。相手側の判断が開き、双方が引き継いだ場合だけ氏名が出る。 */
function ResultSheet({ handover, decision, onClose }: { handover: Handover; decision: Decision; onClose: () => void }) {
  const revealed = decision === 'inherit' && handover.theirs === 'inherit';

  return (
    <div className="sheet">
      <div className="sheet__inner">
        <header className="sheet__head">
          <span className="sheet__title">引継の結果</span>
          <span className="sheet__no">{handover.serial}</span>
          <button type="button" className="sheet__close" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="pad">
          <section className="cover">
            <div className="label">Decision</div>
            <div className="cover__rows">
              <div className="kv">
                <span className="kv__key">あなたの判断</span>
                <span className="kv__value">
                  {decision === 'inherit' ? 'この友情を引き継ぐ' : decision === 'agent_only' ? '代理だけに続けさせる' : 'このまま終わりにする'}
                </span>
              </div>
              <div className="kv">
                <span className="kv__key">相手の判断</span>
                <span className="kv__value">{THEIR_LABEL[handover.theirs]}</span>
              </div>
            </div>
          </section>

          {revealed ? (
            <section className="section">
              <div className="reveal">
                <Avatar name={handover.name} inherited={handover.closeness} current={handover.closeness} />
                <div>
                  <div className="reveal__name">{handover.name}</div>
                  <p className="doc" style={{ fontSize: '14.5px' }}>
                    {handover.relation}
                  </p>
                </div>
              </div>
              <p className="sub">
                両方が引き継ぎました。以後、このやり取りは人間同士のものになります。本人同士が連絡していなかったのは
                {quietLabel(handover.quietDays)}でした。
              </p>
            </section>
          ) : null}

          {decision === 'inherit' && handover.theirs === 'agent_only' ? (
            <>
              <div className="notice">
                相手は自分で返事をしません。以後、相手側の発言はすべて相手の代理です。これは変えられません。
              </div>
              <p className="doc">
                あなたはこれから、{handover.name} の代理人と話します。**{handover.name}** 本人は、この関係に一度も出てきていません。
              </p>
            </>
          ) : null}

          {decision === 'inherit' && handover.theirs === 'refuse' ? (
            <>
              <div className="notice">相手はこの引き継ぎを断りました。理由は聞けません。</div>
              <p className="doc">
                トークは残りますが、{handover.name} からの返信はありません。あなたの代理は、まだ続けたいと言っています。
              </p>
            </>
          ) : null}

          {decision !== 'inherit' ? (
            <p className="doc">
              {decision === 'agent_only'
                ? 'あなたはこのやり取りに入りませんでした。週に一度、代理からの報告だけが届きます。'
                : 'このやり取りは無くなりました。相手には知らされていません。あなたの代理は、しばらく相手を待ち続けます。'}
            </p>
          ) : null}

          <button className="btn" type="button" onClick={onClose}>
            トークへ戻る
            <span className="btn__hint">BACK</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 出どころ付きの一行。
 *
 * **「推測」だけが作り話。**残りは過去ログか、本人が答えたか、相手から聞いたか
 * のどれか。並べてしまえば、どれがどれだか一目で分かる——分かるのに、
 * 相手にとってはもう全部が事実になっている。
 */
function Line({ belief }: { belief: Belief }) {
  return (
    <p className={`belief${belief.source === 'guess' ? ' belief--guess' : ''}`}>
      <span className={`src src--${belief.source}`}>{SOURCE_LABEL[belief.source]}</span>
      <span className="belief__text">{belief.text}</span>
      {belief.from ? <span className="belief__from">過去ログ「{belief.from}」</span> : null}
    </p>
  );
}
