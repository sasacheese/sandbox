import { useState } from 'react';
import { remember, verify } from '../lib/gate.ts';

/**
 * 入口。合言葉を知らない者は入れない。
 *
 * 説明を置かない。何のコミュニティかも書かない。錠そのものが最初の演出で、
 * ここで「よくわからない場所に来てしまった」が始まる。
 *
 * 照合は端末の中で 30 万回の鍵導出を回すので、押してから開くまで一瞬止まる。
 * その待ちは隠さず「照合している」と出す（速すぎると錠に見えない）。
 */
export function Gate({ onOpen }: { onOpen: () => void }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(): Promise<void> {
    if (busy || input.trim() === '') return;
    setBusy(true);
    setFailed(false);
    const ok = await verify(input.trim());
    setBusy(false);
    if (!ok) {
      setFailed(true);
      setInput('');
      return;
    }
    remember();
    onOpen();
  }

  return (
    <form
      className="enroll"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="label">Closed</div>
      <h1 className="enroll__title">この場所には合言葉が要る。</h1>

      <div className="field">
        <input
          className="input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setFailed(false);
          }}
          placeholder="合言葉"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
        />
        {failed ? <span className="sub" style={{ color: 'var(--accent)' }}>合言葉が違う。</span> : null}
      </div>

      <button className="btn" type="submit" disabled={busy || input.trim() === ''}>
        {busy ? '照合している' : '入る'}
        <span className="btn__hint">ENTER</span>
      </button>
    </form>
  );
}
