import { useEffect, useState } from 'react';
import { since } from '../lib/format.ts';
import { forget } from '../lib/gate.ts';
import { applyUpdate, offlineReady, registrationError, subscribeUpdate, updateReady } from '../lib/updates.ts';
import { useStore } from '../store.tsx';
import { useNow } from '../useNow.ts';

export function SettingsView({ onReset }: { onReset: () => void }) {
  const { me, rename, feed, posts, replies, wipe, persistent } = useStore();
  const now = useNow(60_000);
  const [handle, setHandle] = useState(me?.handle ?? '');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => subscribeUpdate(() => bump((n) => n + 1)), []);

  return (
    <div className="screen">
      <header className="header">
        <span className="header__title">自分</span>
      </header>

      <div className="composer">
        <span className="label">表示名</span>
        <input
          className="input"
          value={handle}
          onChange={(e) => setHandle(e.target.value.slice(0, 16))}
          onBlur={() => {
            if (handle.trim() && handle.trim() !== me?.handle) void rename(handle);
          }}
          autoComplete="off"
        />
        <span className="sub">
          書き込み {posts.length} 件・返信 {replies.length} 件。どれもこの端末の中だけにあります。
        </span>
      </div>

      <div className="list">
        <div className="list__row">
          <div className="list__body">
            <div className="list__title">流れの最終更新</div>
            <div className="list__meta">{since(feed.generatedAt, now)}</div>
          </div>
        </div>
        <div className="list__row">
          <div className="list__body">
            <div className="list__title">保存</div>
            <div className="list__meta">{persistent ? '端末に保存しています' : '保存できません（再読み込みで消えます）'}</div>
          </div>
        </div>
        <div className="list__row">
          <div className="list__body">
            <div className="list__title">オフライン</div>
            <div className="list__meta">
              {registrationError() ?? (offlineReady() ? '保存済み。圏外でも開きます' : '開発サーバでは登録しません')}
            </div>
          </div>
        </div>
      </div>

      {updateReady() ? (
        <button className="btn btn--ghost btn--wide" type="button" onClick={applyUpdate}>
          新しい版に更新する
        </button>
      ) : null}

      <div className="section__head">この端末から出る</div>
      <button
        className="btn btn--ghost btn--wide"
        type="button"
        onClick={() => {
          forget();
          location.reload();
        }}
      >
        合言葉の記憶を消す
      </button>

      {confirmWipe ? (
        <>
          <div className="notice">書き込み・返信・押した心をすべて消します。取り消せません。</div>
          <button
            className="btn btn--wide"
            type="button"
            onClick={() => {
              void wipe().then(onReset);
            }}
          >
            すべて消す
          </button>
          <button className="btn btn--quiet btn--wide" type="button" onClick={() => setConfirmWipe(false)}>
            やめる
          </button>
        </>
      ) : (
        <button className="btn btn--quiet btn--wide" type="button" onClick={() => setConfirmWipe(true)}>
          自分の書き込みをすべて消す
        </button>
      )}
    </div>
  );
}
