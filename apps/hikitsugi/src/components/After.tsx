import { afterRight, afterWrong } from '../lib/after.ts';
import { closenessLabel, dueLabel } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 引き継いだあと。
 *
 * ここで初めて、渡されたものが「関係」ではなく**維持する義務**だと分かる。
 * 相手は覚えている前提で話しかけてくる。答えは全部引継書に書いてあるので、
 * 読み返せば必ず分かる。読み返さないと分からない、というのがこの作品の芯。
 */
export function Contacts() {
  const { handover, messages, questions, after, elapsed, answer, closenessOf } = useStore();
  if (!handover) return null;

  const arrived = messages.filter((m) => m.day <= elapsed);

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">連絡</span>
        <span className="brand__no">引継から {elapsed} 日</span>
      </header>

      {arrived.length === 0 ? <div className="empty">まだ連絡はありません。</div> : null}

      {[...arrived].reverse().map((message) => {
        const from = handover.companions.find((c) => c.id === message.from);
        if (!from) return null;
        const question = message.questionId ? questions.find((q) => q.id === message.questionId) : undefined;
        const given = question ? after.answers[question.id] : undefined;
        return (
          <article className="message" key={message.id}>
            <div className="message__head">
              <Avatar name={from.name} small />
              <span className="message__name">{from.name}</span>
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
                {given ? (
                  <p className={`verdict${given.correct ? '' : ' verdict--wrong'}`}>
                    {given.correct ? afterRight(from) : afterWrong(from)}
                    {given.correct ? '' : `（親密度 ${closenessOf(from.id)}・${closenessLabel(closenessOf(from.id))}）`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/** 約束。期限は引き継ぎからの日数で、放っておくと超過する。 */
export function Pledges() {
  const { handover, after, elapsed, setPledge } = useStore();
  if (!handover) return null;

  return (
    <div className="screen">
      <header className="brand">
        <span className="brand__name">約束</span>
        <span className="brand__no">{handover.pledges.length} 件</span>
      </header>

      {handover.pledges.map((pledge) => {
        const to = handover.companions.find((c) => c.id === pledge.to);
        const status = after.pledges[pledge.id] ?? pledge.status;
        const due = dueLabel(pledge.dueDay, elapsed);
        return (
          <article className={`pledge${due.overdue && status === 'pending' ? ' pledge--overdue' : ''}`} key={pledge.id}>
            <div className={`pledge__due${due.overdue && status === 'pending' ? ' pledge__due--overdue' : ''}`}>
              期限 {pledge.dueDay} 日 — {due.text}
            </div>
            <p className="pledge__body">{pledge.body}</p>
            <div className="sub">相手：{to?.name}</div>
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

/** 設定。時間の倍率と、記録の消去だけ。 */
export function Settings({ onReset }: { onReset: () => void }) {
  const { after, setRate, reset, handover, persistent } = useStore();

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
          <span className="section__title">保存</span>
        </div>
        <span className="sub">
          {persistent ? '引継書はこの端末に保存されています。' : '保存できません（再読み込みで消えます）。'}
        </span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">03</span>
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
