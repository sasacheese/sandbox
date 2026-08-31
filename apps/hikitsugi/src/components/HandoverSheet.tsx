import { useState } from 'react';
import { closenessLabel, dateLabel } from '../lib/format.ts';
import type { Decision, Handover, TheirDecision } from '../lib/types.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';
import { Chart } from './Chart.tsx';
import { DayGrid } from './DayGrid.tsx';
import { Ribbon } from './Ribbon.tsx';

const THEIR_LABEL: Record<TheirDecision, string> = {
  inherit: '相手方も引き継ぎました',
  refuse: '相手方は引き継ぎませんでした',
  agent_only: '相手方は代理人に任せました',
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
              あなたの代理人に、
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
                <span className="kv__key">本人同士の沈黙</span>
                <span className="kv__value">{handover.dormant}</span>
              </div>
              <div className="kv">
                <span className="kv__key">交流期間</span>
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
                <span className="kv__key">解決した対立</span>
                <span className="kv__value num">{handover.tally.conflicts} 件</span>
              </div>
              <div className="kv">
                <span className="kv__key">友情に至らなかった相手</span>
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
                  <span>代理人が {handover.closeness} まで築いた</span>
                </div>
              </div>

              <div className="field">
                <span className="field__key">相手があなたに打ち明けたこと</span>
                <p className="field__value">{handover.secret}</p>
              </div>

              <div className="field">
                <span className="field__key">相手があなたについて信じていること</span>
                <div className="beliefs">
                  {handover.beliefs.map((belief) => (
                    <p className={`belief${belief.fabricated ? ' belief--fabricated' : ''}`} key={belief.text}>
                      {belief.fabricated ? <span className="mark-proxy">代理</span> : null}
                      {belief.text}
                    </p>
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
              <span className="section__title">代理人が外へ出した情報</span>
            </div>
            <p className="sub">関係を築くため、以下をあなたについての事実として共有しました。</p>
            {handover.leaked.map((line) => (
              <div className="leak" key={line}>
                {line.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
              </div>
            ))}
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
                body="以後はあなたが応対します。トークが「トーク」へ移ります。相手側の人間が応対するかどうかは、確定してから分かります。"
                on={confirm === 'inherit'}
                onClick={() => setConfirm('inherit')}
              />
              <Choice
                title="代理人だけに続けさせる"
                body="あなたは受け取りません。週に一度、代理人の報告だけがそのトークに届きます。"
                on={confirm === 'agent_only'}
                onClick={() => setConfirm('agent_only')}
              />
              <Choice
                title="相手を知らないまま終了する"
                body="この関係は破棄されます。相手には通知されません。"
                on={confirm === 'end'}
                onClick={() => setConfirm('end')}
              />
            </div>

            {confirm ? (
              <>
                <div className="notice">
                  {confirm === 'inherit'
                    ? '引き継ぎを申請します。相手方の判断は、この引継書の発行時点で確定しています。'
                    : confirm === 'agent_only'
                      ? 'あなたはこの関係の当事者になりません。取り消せません。'
                      : 'この関係を破棄します。取り消せません。'}
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
                  {decision === 'inherit' ? 'この友情を引き継ぐ' : decision === 'agent_only' ? '代理人だけに続けさせる' : '知らないまま終了する'}
                </span>
              </div>
              <div className="kv">
                <span className="kv__key">相手方の判断</span>
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
                双方が引き継ぎを希望しました。以後、このやり取りは人間同士のものになります。本人同士の沈黙は
                {handover.dormant}でした。
              </p>
            </section>
          ) : null}

          {decision === 'inherit' && handover.theirs === 'agent_only' ? (
            <>
              <div className="notice">
                相手方の人間は応対しません。以後、相手側の発言はすべて相手方の代理人によるものです。この扱いは変更できません。
              </div>
              <p className="doc">
                あなたはこれから、{handover.name} の代理人と話します。**{handover.name}** 本人は、この関係に一度も出てきていません。
              </p>
            </>
          ) : null}

          {decision === 'inherit' && handover.theirs === 'refuse' ? (
            <>
              <div className="notice">相手方の人間は、この関係の引き継ぎを希望しませんでした。理由は共有されていません。</div>
              <p className="doc">
                トークは残りますが、{handover.name} からの返信はありません。あなたの代理人は、まだ続けることを希望しています。
              </p>
            </>
          ) : null}

          {decision !== 'inherit' ? (
            <p className="doc">
              {decision === 'agent_only'
                ? 'あなたはこの関係の当事者になりませんでした。週に一度、代理人からの報告だけが届きます。'
                : 'この関係は破棄されました。相手には通知されません。あなたの代理人は、当面のあいだ相手を待ち続けます。'}
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
