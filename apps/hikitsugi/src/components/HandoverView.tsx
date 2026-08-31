import { useState } from 'react';
import { closenessLabel, dateLabel } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';
import { Chart } from './Chart.tsx';
import { DayGrid } from './DayGrid.tsx';
import { Exchanges } from './Exchanges.tsx';
import { Ribbon } from './Ribbon.tsx';

/**
 * 引継書。
 *
 * 並びに意味を持たせている。**先にやり取りを読ませ、そのあとで項目に
 * 分解されたものを見せる。**逆にすると「関係の仕様書」から入ることになり、
 * 相手が人であることが最初から消えてしまう。
 *
 * 相手の氏名はこの書類にも載らない。開示は判断のあと。
 */
export function HandoverView({ decidable = false }: { decidable?: boolean }) {
  const { handover, intake, closeness, inherited, elapsed, horizon, revealed, decide, after } = useStore();
  const [openLog, setOpenLog] = useState(false);
  const [confirm, setConfirm] = useState<'inherit' | 'end' | 'agent_only' | null>(null);
  if (!handover || !intake) return null;
  const { counterpart, tally } = handover;

  return (
    <div className={decidable ? 'screen screen--flow' : 'screen'}>
      <header className="brand">
        <span className="brand__name">関係引継書</span>
        <span className="brand__no">{handover.serial}</span>
      </header>

      <Ribbon proxyDays={handover.days} proxyFilled={handover.days} elapsed={elapsed} horizon={horizon} />

      <section className="cover">
        <div className="cover__title">
          あなたの代理人に、
          <br />
          友達ができました。
        </div>

        <Chart
          people={[{ id: counterpart.id, name: counterpart.alias, metDay: 1, inherited, current: closeness }]}
          proxyDays={handover.days}
          proxyFilled={handover.days}
          elapsed={elapsed}
          horizon={horizon}
        />

        <div className="cover__rows">
          <div className="kv">
            <span className="kv__key">相手</span>
            <span className="kv__value">
              {revealed ? counterpart.name : `${counterpart.alias}（氏名は開示されていません）`}
            </span>
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
            <span className="kv__value num">{tally.messages.toLocaleString('en-US')} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">打ち明けられたこと</span>
            <span className="kv__value num">{tally.secrets} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">解決した対立</span>
            <span className="kv__value num">{tally.conflicts} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">一緒に立てた計画</span>
            <span className="kv__value num">{tally.plans} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">友情に至らなかった相手</span>
            <span className="kv__value num">{tally.otherAgents} 人の代理人</span>
          </div>
          <div className="kv">
            <span className="kv__key">発行日</span>
            <span className="kv__value">{dateLabel(handover.issuedAt)}</span>
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
          <span className="section__title">代理人同士のやり取り</span>
        </div>
        <p className="sub">全 {tally.messages.toLocaleString('en-US')} 件のうち、関係の節目にあたるものを抜粋しています。</p>
        <Exchanges exchanges={handover.exchanges} alias={counterpart.alias} limit={openLog ? undefined : 8} />
        {!openLog ? (
          <button className="btn btn--ghost" type="button" onClick={() => setOpenLog(true)}>
            残りのやり取りを読む
          </button>
        ) : null}
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">02</span>
          <span className="section__title">引き継ぐ関係</span>
        </div>
        <article className="person">
          <div className="person__head">
            <Avatar name={revealed ? counterpart.name : counterpart.alias} inherited={inherited} current={closeness} />
            <span className="person__name">{revealed ? counterpart.name : counterpart.alias}</span>
            <span className="person__calls">
              あなたの呼び方
              <strong>{counterpart.calls}</strong>
            </span>
          </div>

          {revealed ? <p className="sub">{counterpart.relation}</p> : <p className="sub">接点は、引き継ぎ後に開示されます。</p>}

          <div className="meter">
            <div className="meter__bar">
              <div className="meter__proxy" style={{ width: `${Math.min(inherited, closeness)}%` }} />
              {closeness > inherited ? <div className="meter__fill" style={{ width: `${closeness - inherited}%` }} /> : null}
              {closeness < inherited ? <div className="meter__lost" style={{ width: `${inherited - closeness}%` }} /> : null}
            </div>
            <div className="meter__row">
              <span>{closenessLabel(closeness)}</span>
              <span>代理人が {inherited} まで築いた</span>
            </div>
          </div>

          <div className="field">
            <span className="field__key">相手があなたに打ち明けたこと</span>
            <p className="field__value">{counterpart.secret}</p>
          </div>

          <div className="field">
            <span className="field__key">相手があなたについて信じていること</span>
            <div className="beliefs">
              {counterpart.beliefs.map((belief) => (
                <p className={`belief${belief.fabricated ? ' belief--fabricated' : ''}`} key={belief.text}>
                  {belief.fabricated ? <span className="mark-proxy">代理</span> : null}
                  {belief.text}
                </p>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__key">触れてはいけないこと</span>
            <p className="field__value">{counterpart.avoid}</p>
          </div>

          <div className="field">
            <span className="field__key">内輪の言い回し</span>
            <p className="field__value">
              「{counterpart.joke.phrase}」——{counterpart.joke.meaning}
            </p>
          </div>
        </article>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">03</span>
          <span className="section__title">引き継ぐ約束</span>
        </div>
        {handover.pledges.map((pledge) => (
          <div className="pledge" key={pledge.id}>
            <div className="pledge__due">引き継ぎから {pledge.dueDay} 日以内</div>
            <p className="pledge__body">{pledge.body}</p>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">04</span>
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
          <span className="section__no">05</span>
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

      {decidable ? (
        <section className="section">
          <div className="section__head">
            <span className="section__no">06</span>
            <span className="section__title">この友情をどうしますか</span>
          </div>
          {after.extended > 0 ? <p className="sub">これまでに {after.extended} 回、交流を延長しています。</p> : null}

          <div className="decisions">
            <Choice
              title="この友情を引き継ぐ"
              body="以後はあなたが応対します。相手の氏名が開示されます（相手も引き継いだ場合）。"
              on={confirm === 'inherit'}
              onClick={() => setConfirm('inherit')}
            />
            <Choice
              title="もう少し代理人に続けさせる"
              body={`交流期間を 14 日延ばします。関係は深くなり、引き継ぎはその分むずかしくなります。`}
              on={false}
              onClick={() => void decide('extend')}
            />
            <Choice
              title="代理人だけに続けさせる"
              body="あなたは受け取りません。氏名は開示されません。週に一度、報告だけが届きます。"
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
              <button className="btn" type="button" onClick={() => void decide(confirm)}>
                確定する
                <span className="btn__hint">CONFIRM</span>
              </button>
              <button className="btn btn--quiet" type="button" onClick={() => setConfirm(null)}>
                やめる
              </button>
            </>
          ) : null}
        </section>
      ) : null}
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
