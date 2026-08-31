import { useState } from 'react';
import { remember, verify } from '../lib/gate.ts';

export function Gate({ onOpen }: { onOpen: () => void }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <form
      className="enter"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || input.trim() === '') return;
        setBusy(true);
        setFailed(false);
        void verify(input.trim()).then((ok) => {
          setBusy(false);
          if (!ok) {
            setFailed(true);
            setInput('');
            return;
          }
          remember();
          onOpen();
        });
      }}
    >
      <div className="label">Closed</div>
      <div className="cover__title" style={{ fontSize: '21px' }}>
        関係引継サービス
      </div>
      <p className="sub">合言葉を入力してください。</p>
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
      {failed ? <span className="sub" style={{ color: 'var(--warn)' }}>合言葉が違います。</span> : null}
      <button className="btn" type="submit" disabled={busy || input.trim() === ''}>
        {busy ? '照合しています' : '入る'}
      </button>
    </form>
  );
}
