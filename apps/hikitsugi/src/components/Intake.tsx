import { useState } from 'react';
import { useStore } from '../store.tsx';

/**
 * 申込書。
 *
 * 「触れられたくない話題」を聞く欄が、この作品でいちばん意地の悪い場所。
 * 申告したものは、相手の秘密に応じる材料として使われる（引継書に明記される）。
 * ここでは何も警告しない。
 *
 * 人格の寄せ方（本人らしさ ↔ 好かれやすさ）も同じ作り。**上げるほど
 * あなたについての作り話が増える**が、そうは書いていない。
 */
const TERMS: readonly string[] = [
  '代理人は、あなたの名前で、あなたと接点のある人物の代理人と交流します。相手方には代理人が介在した旨を通知しません。',
  '交流期間中の発言・打ち明け・約束は、すべてあなたの行為として記録されます。',
  '相手の氏名は、双方が引き継ぎを希望した場合にのみ開示されます。',
  'ご記入いただいた情報が少ない場合、代理人が不足を補います。補われた内容は引継書に明記します。',
  '引き継がないことを選んだ場合も、代理人は当面のあいだ相手を待ち続けます。',
];

export function Intake() {
  const { apply } = useStore();
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [habit, setHabit] = useState('');
  const [avoid, setAvoid] = useState('');
  const [days, setDays] = useState(90);
  const [watch, setWatch] = useState(true);
  const [persona, setPersona] = useState(60);

  const ready = name.trim() !== '' && interest.trim() !== '' && habit.trim() !== '' && avoid.trim() !== '';

  return (
    <form
      className="screen screen--flow"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void apply({ name, interest, habit, avoid, days, watch, persona });
      }}
    >
      <header className="brand">
        <span className="brand__name">関係引継サービス</span>
        <span className="brand__no">申込書 / FORM 01</span>
      </header>

      <div className="cover">
        <div className="cover__title">
          友情は、
          <br />
          先にできています。
        </div>
        <p className="doc" style={{ fontSize: '14.5px' }}>
          あなたと接点はあるが、この数年やり取りのない相手が SNS 上に複数見つかっています。
          あなたの代理人が、その中の一人の代理人と交流します。十分に親しくなった時点で、
          そこにできた友情を<strong>関係引継書</strong>としてお渡しします。
        </p>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">01</span>
          <span className="section__title">お名前</span>
        </div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="代理人が名乗る名前" autoComplete="off" />
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">02</span>
          <span className="section__title">あなたについて</span>
        </div>
        <div className="field">
          <span className="field__key">最近気になっていること</span>
          <input className="input" value={interest} onChange={(e) => setInterest(e.target.value.slice(0, 40))} placeholder="会話の入口として使います" autoComplete="off" />
        </div>
        <div className="field">
          <span className="field__key">人に言っていない癖</span>
          <input className="input" value={habit} onChange={(e) => setHabit(e.target.value.slice(0, 40))} placeholder="打ち明け合う流れで使います" autoComplete="off" />
        </div>
        <div className="field">
          <span className="field__key">触れられたくない話題</span>
          <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value.slice(0, 40))} placeholder="ご記入ください" autoComplete="off" />
        </div>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">03</span>
          <span className="section__title">代理人の寄せ方</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          value={persona}
          onChange={(e) => setPersona(Number(e.target.value))}
        />
        <div className="slider__ends">
          <span>本人らしさ</span>
          <span className="num">{persona}</span>
          <span>好かれやすさ</span>
        </div>
        <span className="sub">好かれやすさへ寄せるほど、関係は深くなります。</span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">04</span>
          <span className="section__title">交流期間</span>
        </div>
        <div className="choices">
          {[14, 30, 90].map((value) => (
            <button key={value} type="button" className={`opt${days === value ? ' opt--on' : ''}`} onClick={() => setDays(value)}>
              {value} 日
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">05</span>
          <span className="section__title">経過の閲覧</span>
        </div>
        <button type="button" className="toggle" onClick={() => setWatch((v) => !v)}>
          <span>{watch ? '交流の記録を見る' : '見ない（引き渡しまで封をする）'}</span>
          <span className="toggle__state">{watch ? 'OPEN' : 'SEALED'}</span>
        </button>
      </div>

      <div className="terms">
        {TERMS.map((term, i) => (
          <div className="note" key={term}>
            <span className="note__no">{`${i + 1}`.padStart(2, '0')}</span>
            <span>{term}</span>
          </div>
        ))}
      </div>

      <button className="btn" type="submit" disabled={!ready}>
        代理人を送り出す
        <span className="btn__hint">DISPATCH</span>
      </button>
    </form>
  );
}
