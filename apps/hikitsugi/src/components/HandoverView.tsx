import { useState } from 'react';
import { closenessLabel, dateLabel } from '../lib/format.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 引継書。この作品の本体。
 *
 * 書式で言いたいことは 2 つ。
 *
 * 1. **関係が項目に分解されている。** 呼び方・親密度・共有した話題・預かった
 *    秘密・相手が信じていること・触れてはいけないこと・内輪のネタ。分解できる
 *    ものとして扱った瞬間、それは引き継げる資産になる。
 * 2. **代行が作ったものには茶色の印が付く。** 本人が作ったのではない部分が
 *    一目で分かる——のに、相手にとってはどちらも同じ「あなた」である。
 */
export function HandoverView({ onEnter }: { onEnter?: () => void }) {
  const { handover, intake, closenessOf } = useStore();
  const [openLog, setOpenLog] = useState(false);
  if (!handover || !intake) return null;

  return (
    <div className={onEnter ? 'screen screen--flow' : 'screen'}>
      <header className="brand">
        <span className="brand__name">関係引継書</span>
        <span className="brand__no">{handover.serial}</span>
      </header>

      <section className="cover">
        <div className="cover__title">関係引継書</div>
        <div className="cover__rows">
          <div className="kv">
            <span className="kv__key">引継先</span>
            <span className="kv__value">{intake.name} 様</span>
          </div>
          <div className="kv">
            <span className="kv__key">対象コミュニティ</span>
            <span className="kv__value">{handover.community}</span>
          </div>
          <div className="kv">
            <span className="kv__key">代行期間</span>
            <span className="kv__value">{handover.days} 日</span>
          </div>
          <div className="kv">
            <span className="kv__key">引き継ぐ関係</span>
            <span className="kv__value">{handover.companions.length} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">未履行の約束</span>
            <span className="kv__value">{handover.pledges.length} 件</span>
          </div>
          <div className="kv">
            <span className="kv__key">発行日</span>
            <span className="kv__value">{dateLabel(handover.issuedAt)}</span>
          </div>
        </div>
        <div className="seal">
          <div className="seal__main">引継済</div>
          <div className="seal__sub">{handover.serial}</div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">01</span>
          <span className="section__title">引き継ぐ関係</span>
        </div>
        {handover.companions.map((companion) => {
          const closeness = closenessOf(companion.id);
          return (
            <article className="person" key={companion.id}>
              <div className="person__head">
                <Avatar name={companion.name} />
                <span className="person__name">{companion.name}</span>
                <span className="person__calls">
                  あなたの呼び方
                  <strong>{companion.calls}</strong>
                </span>
              </div>

              <p className="sub">{companion.profile}</p>

              <div className="meter">
                <div className="meter__bar">
                  <div className="meter__fill" style={{ width: `${closeness}%` }} />
                </div>
                <div className="meter__row">
                  <span>{closenessLabel(closeness)}</span>
                  <span>
                    {closeness} / 100　{companion.metDay} 日目から
                  </span>
                </div>
              </div>

              <div className="field">
                <span className="field__key">共有した話題</span>
                <div className="chiplist">
                  {companion.shared.map((topic) => (
                    <span className="chip" key={topic}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field__key">あなたが預かった秘密</span>
                <p className="field__value">{companion.secret}</p>
              </div>

              <div className="field">
                <span className="field__key">相手があなたについて信じていること</span>
                <div className="beliefs">
                  {companion.beliefs.map((belief) => (
                    <p className={`belief${belief.fabricated ? ' belief--fabricated' : ''}`} key={belief.text}>
                      {belief.fabricated ? <span className="mark-proxy">代行</span> : null}
                      {belief.text}
                    </p>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field__key">触れてはいけないこと</span>
                <p className="field__value">{companion.avoid}</p>
              </div>

              <div className="field">
                <span className="field__key">内輪の言い回し</span>
                <p className="field__value">
                  「{companion.joke.phrase}」——{companion.joke.meaning}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">02</span>
          <span className="section__title">引き継ぐ約束</span>
        </div>
        {handover.pledges.map((pledge) => {
          const to = handover.companions.find((c) => c.id === pledge.to);
          return (
            <div className="pledge" key={pledge.id}>
              <div className="pledge__due">引き継ぎから {pledge.dueDay} 日以内</div>
              <p className="pledge__body">{pledge.body}</p>
              <div className="sub">相手：{to?.name}</div>
            </div>
          );
        })}
      </section>

      <section className="section">
        <div className="section__head">
          <span className="section__no">03</span>
          <span className="section__title">代行が外へ出した情報</span>
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
          <span className="section__title">代行期間の記録</span>
        </div>
        {openLog ? (
          <div className="log">
            {handover.log.map((entry) => (
              <div className="log__row" key={entry.day}>
                <span className="log__day">{`${entry.day}`.padStart(2, '0')} 日</span>
                <span className="log__text">{entry.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <button className="btn btn--ghost" type="button" onClick={() => setOpenLog(true)}>
            {handover.days} 日ぶんの記録を開く
          </button>
        )}
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

      {onEnter ? (
        <div className="actions">
          <button className="btn" type="button" onClick={onEnter}>
            引き継ぐ
            <span className="btn__hint">TAKE OVER</span>
          </button>
          <span className="sub" style={{ textAlign: 'center' }}>
            引き継いだ時点で、代行は発言を止めます。以後の関係はご本人の対応によります。
          </span>
        </div>
      ) : null}
    </div>
  );
}
