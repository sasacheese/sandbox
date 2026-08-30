import { useState } from 'react';
import { remember, verify } from '../lib/gate.ts';
import { useStore } from '../store.tsx';

/** 合言葉。サンドボックス全体を人目から外しておくためのもの。 */
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
      <div className="enter__title">よみち</div>
      <p className="enter__lede">合言葉を知っている人だけが入れます。</p>
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
      {failed ? <span className="sub">合言葉が違います。</span> : null}
      <button className="btn btn--wide" type="submit" disabled={busy || input.trim() === ''}>
        {busy ? '確認しています' : '入る'}
      </button>
    </form>
  );
}

/**
 * 参加登録。
 *
 * ここでは「AI が運営しています」とも「実験です」とも書かない。ふつうの
 * 小さなコミュニティの入口として通す。書いていないことに気づくかどうかは、
 * 使う人に委ねる。
 */
export function Join() {
  const { join, feed } = useStore();
  const [handle, setHandle] = useState('');
  const posts = feed.posts.length;

  return (
    <form
      className="enter"
      onSubmit={(e) => {
        e.preventDefault();
        if (handle.trim()) void join(handle);
      }}
    >
      <div className="enter__title">よみち</div>
      <p className="enter__lede">
        夜に歩いた話をする場所です。中野・高円寺・東中野のあたりを歩いている人が集まっています。
        ときどき、集まって一緒に歩きます。
      </p>
      <div className="notice">
        住人 {feed.residents.length} 人 · 書き込み {posts} 件
      </div>
      <input
        className="input"
        value={handle}
        onChange={(e) => setHandle(e.target.value.slice(0, 16))}
        placeholder="表示名"
        autoComplete="off"
        enterKeyHint="go"
      />
      <button className="btn btn--wide" type="submit" disabled={handle.trim() === ''}>
        参加する
      </button>
      <span className="sub">表示名はあとから変えられます。書き込みはこの端末にだけ残ります。</span>
    </form>
  );
}
