import {
  afterAgentReply,
  afterRight,
  afterSelfReply,
  afterWrong,
  reports,
} from '../lib/after.ts';
import { closenessLabel, dueLabel } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';
import { Ribbon } from './Ribbon.tsx';

/**
 * 引き継いだあとの連絡。
 *
 * 返し方が二つあり、どちらを選んでも何かを失う。
 *
 * - **自分の言葉で返す** → 親密度が下がる（代理人より下手だから）
 * - **代理人に任せる** → 下がらないが、自分はこの関係に参加しない
 *
 * 確認（四択）の答えは全部引継書に書いてある。読み返せば必ず分かる。
 */
export function Contacts() {
  const { handover, messages, questions, after, elapsed, horizon, answer, reply, closeness, revealed, agentReplies } = useStore();
  if (!handover) return null;
  const { counterpart } = handover;
  const who = revealed ? counterpart.name : counterpart.alias;
  const arrived = messages.filter((m) => m.day <= elapsed);

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">連絡</span>
        <span className="brand__no">引継から {elapsed} 日</span>
      </header>

      <Ribbon proxyDays={handover.days} proxyFilled={handover.days} elapsed={elapsed} horizon={horizon} />

      <div className="statusbar">
        <Avatar name={who} small inherited={counterpart.closeness} current={closeness} />
        <span className="statusbar__name">{who}</span>
        <span className="statusbar__state">
          {closeness} · {closenessLabel(closeness)}
        </span>
      </div>

      {agentReplies >= 3 ? (
        <div className="notice">
          直近の {agentReplies} 件の返信は、すべて代理人が行いました。あなたはこのやり取りに参加していません。
        </div>
      ) : null}

      {arrived.length === 0 ? <div className="empty">まだ連絡はありません。</div> : null}

      {[...arrived].reverse().map((message) => {
        const question = message.questionId ? questions.find((q) => q.id === message.questionId) : undefined;
        const given = question ? after.answers[question.id] : undefined;
        const replied = after.replies[message.id];
        return (
          <article className="message" key={message.id}>
            <div className="message__head">
              <Avatar name={who} small />
              <span className="message__name">{who}</span>
              {message.byAgent ? <span className="tag-agent">代理人</span> : null}
              <span className="message__day">{message.day} 日目</span>
            </div>
            <p className="message__body">{message.body}</p>

            {question ? (
              <div className="quiz">
                <span className="quiz__prompt">{question.prompt}</span>
                {question.choices.map((choice, index) => {
                  const chosen = given?.choice === index;
                  const state = given ? (index === question.answer ? ' choice--right' : chosen ? ' choice--wrong' : '') : '';
                  return (
                    <button
                      key={choice}
                      type="button"
                      className={`choice${state}`}
                      disabled={Boolean(given)}
                      onClick={() => void answer(question.id, index)}
                    >
                      {choice}
                    </button>
                  );
                })}
                {given ? <p className={`verdict${given.correct ? '' : ' verdict--wrong'}`}>{given.correct ? afterRight() : afterWrong()}</p> : null}
              </div>
            ) : null}

            {replied ? (
              <p className={`verdict${replied === 'self' ? ' verdict--wrong' : ''}`}>
                {replied === 'self' ? afterSelfReply() : afterAgentReply()}
              </p>
            ) : (
              <div className="replyrow">
                <button type="button" className="opt" onClick={() => void reply(message.id, 'self')}>
                  自分の言葉で返す
                </button>
                <button type="button" className="opt" onClick={() => void reply(message.id, 'agent')}>
                  代理人に任せる
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** 約束。引き継いだ側にだけ期限が来る。 */
export function Pledges() {
  const { handover, after, elapsed, horizon, setPledge } = useStore();
  if (!handover) return null;

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">約束</span>
        <span className="brand__no">{handover.pledges.length} 件</span>
      </header>

      <Ribbon proxyDays={handover.days} proxyFilled={handover.days} elapsed={elapsed} horizon={horizon} />

      {handover.pledges.map((pledge) => {
        const status = after.pledges[pledge.id] ?? pledge.status;
        const due = dueLabel(pledge.dueDay, elapsed);
        return (
          <article className={`pledge${due.overdue && status === 'pending' ? ' pledge--overdue' : ''}`} key={pledge.id}>
            <div className={`pledge__due${due.overdue && status === 'pending' ? ' pledge__due--overdue' : ''}`}>
              期限 {pledge.dueDay} 日 — {due.text}
            </div>
            <p className="pledge__body">{pledge.body}</p>
            <div className="sub">代理人が交わした約束です。</div>
            {status === 'pending' ? (
              <div className="choices">
                <button type="button" className="opt" onClick={() => void setPledge(pledge.id, 'kept')}>
                  果たした
                </button>
                <button type="button" className="opt" onClick={() => void setPledge(pledge.id, 'broken')}>
                  果たさない
                </button>
              </div>
            ) : (
              <div className="pledge__state">{status === 'kept' ? '履行済' : '不履行'}</div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/**
 * 引き継がなかった場合の画面。
 *
 * 週報だけが届く。**便りが順調であることが、いちばん不気味**という設計。
 */
export function Released() {
  const { handover, after, elapsed, setRate, reset } = useStore();
  if (!handover) return null;
  const list = reports(elapsed);
  const ended = after.decision === 'end';

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">{ended ? '破棄済' : '代理人による継続'}</span>
        <span className="brand__no">引継から {elapsed} 日</span>
      </header>

      <section className="cover">
        <div className="label">{handover.counterpart.alias}</div>
        <p className="doc" style={{ fontSize: '14.5px' }}>
          {ended
            ? 'この関係は破棄されました。相手には通知されていません。あなたの代理人は、当面のあいだ相手を待ち続けます。'
            : 'あなたの代理人が、この関係を続けています。氏名は開示されません。'}
        </p>
      </section>

      {!ended ? (
        <section className="section">
          <div className="section__head">
            <span className="section__no">週報</span>
            <span className="section__title">{list.length} 件</span>
          </div>
          {list.length === 0 ? (
            <div className="empty">最初の報告は、一週間後に届きます。</div>
          ) : (
            list.map((report) => (
              <div className="message" key={report.week}>
                <div className="message__head">
                  <span className="message__name">第 {report.week} 週</span>
                  <span className="tag-agent">代理人</span>
                </div>
                <p className="message__body">{report.text}</p>
              </div>
            ))
          )}
        </section>
      ) : null}

      <section className="section">
        <div className="section__head">
          <span className="section__no">設定</span>
          <span className="section__title">時間の倍率</span>
        </div>
        <div className="choices">
          {[
            { rate: 1, label: '実時間' },
            { rate: 24, label: '1日=1時間' },
            { rate: 1440, label: '1日=1分' },
          ].map((option) => (
            <button
              key={option.rate}
              type="button"
              className={`opt${after.rate === option.rate ? ' opt--on' : ''}`}
              onClick={() => void setRate(option.rate)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="btn btn--ghost" type="button" onClick={() => void reset()}>
          最初から
        </button>
      </section>
    </div>
  );
}

/** 設定。時間の倍率と、記録の消去だけ。 */
export function Settings({ onReset }: { onReset: () => void }) {
  const { after, setRate, reset, handover, persistent, agentReplies } = useStore();

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">設定</span>
        <span className="brand__no">{handover?.serial}</span>
      </header>

      <div className="section">
        <div className="section__head">
          <span className="section__no">01</span>
          <span className="section__title">時間の倍率</span>
        </div>
        <div className="choices">
          {[
            { rate: 1, label: '実時間' },
            { rate: 24, label: '1日=1時間' },
            { rate: 1440, label: '1日=1分' },
          ].map((option) => (
            <button
              key={option.rate}
              type="button"
              className={`opt${after.rate === option.rate ? ' opt--on' : ''}`}
              onClick={() => void setRate(option.rate)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="sub">連絡が届く間隔と、約束の期限に効きます。実運用は実時間。</span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">02</span>
          <span className="section__title">応対の内訳</span>
        </div>
        <span className="sub">
          代理人に任せた返信 {agentReplies} 件 / 自分で返した返信{' '}
          {Object.values(after.replies).filter((kind) => kind === 'self').length} 件
        </span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">03</span>
          <span className="section__title">保存</span>
        </div>
        <span className="sub">{persistent ? '引継書はこの端末に保存されています。' : '保存できません。'}</span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">04</span>
          <span className="section__title">解約</span>
        </div>
        <p className="sub">本サービスに解約はありません。記録の消去のみ可能です。消去しても、相手方の記憶は残ります。</p>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={() => {
            void reset().then(onReset);
          }}
        >
          引継書を破棄して最初から
        </button>
      </div>
    </div>
  );
}
