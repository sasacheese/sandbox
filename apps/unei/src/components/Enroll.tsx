import { useState } from 'react';
import { useStore } from '../store.tsx';

/**
 * 参加登録。
 *
 * 「ようこそ」と言わない。ここで説明されるのは、参加者が持つ権利ではなく、
 * これから何が起きるかだけ。行ける場所を先に登録させるのは実務でもある
 * （運営に完全な自由を与えると、私有地や深夜の危険な場所を指す）。
 * 候補を知らないのは参加者だけなので、選ばれた感じは損なわれない。
 */
export function Enroll() {
  const { enroll } = useStore();
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [places, setPlaces] = useState<string[]>([]);
  const ready = name.trim().length > 0 && places.length > 0;

  function addPlace(): void {
    const value = place.trim();
    if (!value || places.includes(value)) return;
    setPlaces((prev) => [...prev, value]);
    setPlace('');
  }

  return (
    <form
      className="enroll"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void enroll(name, places);
      }}
    >
      <div className="label">Community</div>
      <h1 className="enroll__title">
        このコミュニティの運営は
        <br />
        人ではない。
      </h1>
      <p className="enroll__lede">
        運営は時刻と場所を指定する。指定された者は、そこへ行く。
        <br />
        何をするかは、その都度告げられる。理由は告げられない。
      </p>

      <div className="field">
        <label className="label" htmlFor="name">
          名前
        </label>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="運営から呼ばれる名"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="place">
          行ける場所（一つ以上）
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="place"
            className="input"
            value={place}
            onChange={(e) => setPlace(e.target.value.slice(0, 30))}
            placeholder="例：中野四丁目の公園"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPlace();
              }
            }}
          />
          <button className="btn btn--ghost btn--inline" type="button" onClick={addPlace}>
            足す
          </button>
        </div>
        {places.length > 0 ? (
          <div className="chips">
            {places.map((p) => (
              <button key={p} type="button" className="chip" onClick={() => setPlaces((prev) => prev.filter((x) => x !== p))}>
                {p} ×
              </button>
            ))}
          </div>
        ) : (
          <span className="sub">運営はこの中から集合場所を選ぶ。どれが選ばれるかは知らされない。</span>
        )}
      </div>

      <button className="btn" type="submit" disabled={!ready}>
        参加する
        <span className="btn__hint">ENROLL</span>
      </button>
    </form>
  );
}
