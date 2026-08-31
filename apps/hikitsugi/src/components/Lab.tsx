import { useState } from 'react';
import { useStore } from '../store.tsx';

/**
 * ラボ（実験機能）。**この作品でいちばん現実的な一枚。**
 *
 * 恐ろしいことは、サービスとしてではなく**設定画面のベータのトグル**として
 * やって来る。LINE が「AIトークサジェスト」を LINE Labs のオプトインで出した
 * のと同じ形にしてある。この形にした途端、説明が要らなくなる——
 *
 * - なぜ代理が過去のやり取りを知っているのか → メッセンジャー自身の機能で、
 *   履歴は端末にあるから（実在の機能も「そのトークルーム内の直近のトーク履歴」を使う）
 * - なぜ相手にも代理がいるのか → 相手も同じベータをオンにしたから
 * - なぜ開示があるのか → 法律で決まっているから
 *
 * 数字は作っていない。**この困りごとは実在する。**
 */
const SURVEY: readonly { value: string; body: string }[] = [
  { value: '55.9%', body: '連絡を取りたいが、声をかけづらい人がいる' },
  { value: '41.3%', body: '声をかけづらい理由の一位「どう切り出せばいいかわからない」' },
  { value: '59.2%', body: '久しぶりに連絡が来たら「嬉しい」' },
];

const TERMS: readonly string[] = [
  'このトークが自動応答であることは、最初のやり取りで相手に表示されます（AI法 第50条・2026年8月2日から適用）。',
  '代理が読むのは、そのトークの過去ログだけです。最後のやり取りより後のことは知りません。',
  '代理を出せるのは、相手も代理応答をオンにしている場合に限られます。',
  '代理の発言は、すべてあなたがしたこととして記録されます。',
];

export function Lab() {
  const { enableLab, transcripts } = useStore();
  const [persona, setPersona] = useState(60);

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">代理</span>
        <span className="listhead__note">ベータ</span>
      </header>

      <div className="pad">
        <div className="labcard">
          <div className="label">ラボ · 実験機能</div>
          <div className="labcard__title">代理応答</div>
          <p className="labcard__lede">
            しばらく連絡していない相手に、代理が代わりに声をかけます。
            過去のやり取りを読んで、あなたの書き方で切り出します。
          </p>
        </div>

        <section className="section">
          <div className="section__head">
            <span className="section__no">01</span>
            <span className="section__title">なぜこの機能があるのか</span>
          </div>
          <div className="survey">
            {SURVEY.map((row) => (
              <div className="survey__row" key={row.value}>
                <span className="survey__value num">{row.value}</span>
                <span className="survey__body">{row.body}</span>
              </div>
            ))}
          </div>
          <span className="sub">LINEヤフー調べ（2025年8月・15〜69歳・n=737）</span>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">02</span>
            <span className="section__title">代理の書き方</span>
          </div>
          <input className="slider" type="range" min={0} max={100} value={persona} onChange={(e) => setPersona(Number(e.target.value))} />
          <div className="slider__ends">
            <span>あなたに近い</span>
            <span className="num">{persona}</span>
            <span>好かれやすい</span>
          </div>
          {/* 好かれやすさへ寄せるほど作り話が増える。そうは書いていない */}
          <span className="sub">好かれやすいほうへ寄せると、過去ログに無いことも補って話します。</span>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">03</span>
            <span className="section__title">確認事項</span>
          </div>
          <div className="terms">
            {TERMS.map((term, i) => (
              <div className="note" key={term}>
                <span className="note__no">{`${i + 1}`.padStart(2, '0')}</span>
                <span>{term}</span>
              </div>
            ))}
          </div>
        </section>

        <button className="btn" type="button" disabled={transcripts.length === 0} onClick={() => void enableLab(persona)}>
          代理応答をオンにする
          <span className="btn__hint">ENABLE</span>
        </button>
        <p className="sub" style={{ textAlign: 'center' }}>
          1 日あたり 300 通まで。いつでもオフにできます。
        </p>
      </div>
    </>
  );
}
