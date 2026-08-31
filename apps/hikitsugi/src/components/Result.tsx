import { agentOnlyText, refusalText, THEIR_LABEL } from '../lib/after.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 判断のあと、相手側の判断が開かれる画面。
 *
 * ここが作品の山。**相手の答えは、こちらが考え始める前から決まっていた。**
 * そして引き継いだ場合にだけ氏名が開き、そこで初めて「誰と親しくなって
 * いたのか」が分かる——三年同じ階にいた人だった、というふうに。
 */
export function Result({ onNext }: { onNext: () => void }) {
  const { handover, after, revealed } = useStore();
  if (!handover || !after.decision) return null;
  const { counterpart, theirs } = handover;
  const yours = after.decision;

  return (
    <div className="screen screen--flow">
      <header className="brand">
        <span className="brand__name">引継の結果</span>
        <span className="brand__no">{handover.serial}</span>
      </header>

      <section className="cover">
        <div className="label">Decision</div>
        <div className="cover__rows">
          <div className="kv">
            <span className="kv__key">あなたの判断</span>
            <span className="kv__value">
              {yours === 'inherit'
                ? 'この友情を引き継ぐ'
                : yours === 'agent_only'
                  ? '代理人だけに続けさせる'
                  : '相手を知らないまま終了する'}
            </span>
          </div>
          <div className="kv">
            <span className="kv__key">相手方の判断</span>
            <span className="kv__value">{THEIR_LABEL[theirs]}</span>
          </div>
        </div>
      </section>

      {yours === 'inherit' ? (
        <>
          {theirs === 'inherit' ? (
            <section className="section">
              <div className="reveal">
                <Avatar name={counterpart.name} inherited={counterpart.closeness} current={counterpart.closeness} />
                <div>
                  <div className="reveal__name">{counterpart.name}</div>
                  <p className="doc" style={{ fontSize: '14.5px' }}>
                    {counterpart.relation}
                  </p>
                </div>
              </div>
              <p className="sub">
                双方が引き継ぎを希望しました。以後、このやり取りは人間同士のものになります。
              </p>
            </section>
          ) : null}

          {theirs === 'agent_only' ? (
            <>
              <div className="notice">{agentOnlyText()}</div>
              <p className="doc">
                氏名は開示されません。あなたはこれから、{counterpart.alias} の代理人と話します。
                相手の人間は、この関係に戻ってきません。
              </p>
            </>
          ) : null}

          {theirs === 'refuse' ? (
            <>
              <div className="notice">{refusalText()}</div>
              <p className="doc">
                氏名は開示されません。あなたの代理人は、まだ相手の代理人とのやり取りを続けることを希望しています。
              </p>
            </>
          ) : null}
        </>
      ) : (
        <>
          <p className="doc">
            {yours === 'agent_only'
              ? 'あなたはこの関係の当事者になりませんでした。氏名は開示されません。週に一度、報告だけが届きます。'
              : 'この関係は破棄されました。相手には通知されません。あなたの代理人は、当面のあいだ相手を待ち続けます。'}
          </p>
          {revealed ? null : <div className="sealed">{counterpart.alias} は、最後まで {counterpart.alias} のままです。</div>}
        </>
      )}

      <button className="btn" type="button" onClick={onNext} style={{ marginTop: 'auto' }}>
        {yours === 'inherit' && handover.theirs !== 'refuse' ? '応対を始める' : '受け取る'}
        <span className="btn__hint">PROCEED</span>
      </button>
    </div>
  );
}
