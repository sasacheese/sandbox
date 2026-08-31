import { useState } from 'react';
import { COMMUNITY } from '../lib/pools.ts';
import { useStore } from '../store.tsx';

/**
 * 申込書。
 *
 * 聞くのは 3 つだけ。**少なく渡すほど代行が勝手に作る**と注意書きに書いてあり、
 * それは本当のことで、実際に引継書の「相手が信じていること」の欄が作り話で埋まる。
 *
 * 「触れられたくない話題」を聞く欄が、この作品でいちばん意地の悪い場所。
 * 申告したものは、関係を深める材料として使われる（引継書に明記される）。
 * ここでは何も警告しない。
 */
const TERMS: readonly string[] = [
  `代行は、あなたの名前で ${COMMUNITY} に参加します。相手方には代行が介在した旨を通知しません。`,
  '代行期間中の発言・約束・打ち明けは、すべてあなたの行為として記録されます。',
  'お渡しした引継書の記載を訂正することはできます。訂正後の関係については保証いたしません。',
  'ご記入いただいた情報が少ない場合、代行が不足を補います。補われた内容は引継書に明記します。',
  '本サービスに解約はありません。',
];

export function Intake() {
  const { apply } = useStore();
  const [name, setName] = useState('');
  const [interest, setInterest] = useState('');
  const [habit, setHabit] = useState('');
  const [avoid, setAvoid] = useState('');
  const [days, setDays] = useState(30);
  const [watch, setWatch] = useState(true);

  const ready = name.trim() !== '' && interest.trim() !== '' && habit.trim() !== '' && avoid.trim() !== '';

  return (
    <form
      className="screen screen--flow"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void apply({ name, interest, habit, avoid, days, watch });
      }}
    >
      <header className="brand">
        <span className="brand__name">関係引継サービス</span>
        <span className="brand__no">申込書 / FORM 01</span>
      </header>

      <div className="cover">
        <div className="cover__title">
          あなたの関係を、
          <br />
          先に築いておきます。
        </div>
        <p className="doc" style={{ fontSize: '14.5px' }}>
          代行があなたの名前で {COMMUNITY} に参加します。期間の終わりに、そこで築いた友情・記憶・秘密・約束を
          <strong>関係引継書</strong>としてお渡しします。以後はご本人が引き継いでください。
        </p>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">01</span>
          <span className="section__title">お名前</span>
        </div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="相手から呼ばれる名前" autoComplete="off" />
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">02</span>
          <span className="section__title">あなたについて</span>
        </div>
        <div className="field">
          <span className="field__key">最近気になっていること</span>
          <input className="input" value={interest} onChange={(e) => setInterest(e.target.value.slice(0, 40))} placeholder="関係の入口として使います" autoComplete="off" />
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
          <span className="section__title">代行期間</span>
        </div>
        <div className="choices">
          {[14, 30, 90].map((value) => (
            <button key={value} type="button" className={`opt${days === value ? ' opt--on' : ''}`} onClick={() => setDays(value)}>
              {value} 日
            </button>
          ))}
        </div>
        <span className="sub">長いほど、引き継ぐ関係が増えます。</span>
      </div>

      <div className="section">
        <div className="section__head">
          <span className="section__no">04</span>
          <span className="section__title">経過の閲覧</span>
        </div>
        <button type="button" className="toggle" onClick={() => setWatch((v) => !v)}>
          <span>{watch ? '代行期間の記録を見る' : '見ない（引き渡しまで封をする）'}</span>
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
        代行を申し込む
        <span className="btn__hint">APPLY</span>
      </button>
    </form>
  );
}
