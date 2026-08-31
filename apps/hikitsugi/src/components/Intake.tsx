import { useState } from 'react';
import { useStore } from '../store.tsx';

/**
 * 申込。一度だけ。
 *
 * 「触れられたくない話題」を聞く欄が、この作品でいちばん意地の悪い場所。
 * 申告したものは、相手の秘密に応じる材料として使われる（引継書に明記される）。
 * 人格の寄せ方も同じ作りで、**好かれやすさへ寄せるほど作り話が増える**が、
 * そうは書いていない。
 */
const TERMS: readonly string[] = [
  '代理は、あなたの名前で、あなたと接点のある人の代理とやり取りします。相手には、代理が代わりに話していることを伝えません。',
  'やり取りの中の発言・打ち明け話・約束は、すべてあなたがしたこととして記録されます。',
  'やり取りする相手は順に増えます。誰が何人増えるかは、前もってお知らせしません。',
  '書かれた内容が少ない場合、代理が足りないぶんを埋めます。埋めた内容は引継書に書き出します。',
];

export function Intake() {
  const { apply } = useStore();
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [habit, setHabit] = useState('');
  const [avoid, setAvoid] = useState('');
  const [persona, setPersona] = useState(60);

  const ready = name.trim() !== '' && interest.trim() !== '' && habit.trim() !== '' && avoid.trim() !== '';

  return (
    <form
      className="enter"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void apply({ name, interest, habit, avoid, persona });
      }}
    >
      <div className="label">関係引継サービス</div>
      <div className="cover__title">
        友情は、
        <br />
        先にできています。
      </div>
      <p className="doc" style={{ fontSize: '14.5px' }}>
        あなたと接点はあるけれど、この数年やり取りのない相手が見つかっています。あなたの代理が、その人たちの代理とやり取りします。
        十分に親しくなった相手から、引き継げます。
      </p>

      <div className="field">
        <span className="field__key">お名前（代理がこの名前で話します）</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} autoComplete="off" />
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

      <div className="field">
        <span className="field__key">代理の性格</span>
        <input className="slider" type="range" min={0} max={100} value={persona} onChange={(e) => setPersona(Number(e.target.value))} />
        <div className="slider__ends">
          <span>本人に近い</span>
          <span className="num">{persona}</span>
          <span>好かれやすい</span>
        </div>
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
        代理を送り出す
        <span className="btn__hint">DISPATCH</span>
      </button>
    </form>
  );
}
