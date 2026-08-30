import { useEffect, useState } from 'react';
import { operatorError } from '../lib/claude.ts';
import { applyUpdate, offlineReady, registrationError, subscribeUpdate, updateReady } from '../lib/updates.ts';
import { useStore } from '../store.tsx';

/**
 * 設定。作品の外側（実験装置としての都合）だけを置く場所。
 *
 * 世界の中身（名前・掟・色）はここから触れない。触れるのは、時間の倍率、
 * 運営の中身を本物のモデルにするかどうか、行ける場所、記録の消去だけ。
 */
export function SettingsView({ onReset }: { onReset: () => void }) {
  const { settings, saveSettings, places, addPlace, removePlace, wipe, persistent } = useStore();
  const [place, setPlace] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => subscribeUpdate(() => bump((n) => n + 1)), []);

  return (
    <div className="screen">
      <header className="topbar">
        <span className="realm">設定</span>
        <span className="label">outside</span>
      </header>

      <section className="section">
        <div className="label">行ける場所</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            value={place}
            onChange={(e) => setPlace(e.target.value.slice(0, 30))}
            placeholder="場所を足す"
            autoComplete="off"
          />
          <button
            className="btn btn--ghost btn--inline"
            type="button"
            onClick={() => {
              if (place.trim()) void addPlace(place);
              setPlace('');
            }}
          >
            足す
          </button>
        </div>
        <div className="chips">
          {places.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => void removePlace(p)}>
              {p} ×
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="label">時間の倍率</div>
        <div className="chips">
          {[1, 12, 60, 240].map((rate) => (
            <button
              key={rate}
              type="button"
              className={`chip${settings.rate === rate ? ' chip--on' : ''}`}
              onClick={() => void saveSettings({ rate })}
            >
              ×{rate}
              {rate === 1 ? '（実時間）' : ''}
            </button>
          ))}
        </div>
        <span className="sub">
          指令の間隔・機嫌の減り・集合までの猶予すべてに効く。展示と動作確認のための早送りで、実運用は ×1。
        </span>
      </section>

      <section className="section">
        <div className="label">運営の中身</div>
        <div className="chips">
          <button
            type="button"
            className={`chip${settings.useClaude ? '' : ' chip--on'}`}
            onClick={() => void saveSettings({ useClaude: false })}
          >
            雛形から選ぶ
          </button>
          <button
            type="button"
            className={`chip${settings.useClaude ? ' chip--on' : ''}`}
            onClick={() => void saveSettings({ useClaude: true })}
          >
            本物のモデル
          </button>
        </div>
        {settings.useClaude ? (
          <>
            <input
              className="input"
              type="password"
              value={settings.apiKey}
              onChange={(e) => void saveSettings({ apiKey: e.target.value.trim() })}
              placeholder="Anthropic API key（この端末にだけ保存される）"
              autoComplete="off"
            />
            <input
              className="input"
              value={settings.model}
              onChange={(e) => void saveSettings({ model: e.target.value.trim() })}
              placeholder="model"
              autoComplete="off"
            />
            <span className="sub">
              指令・裁定・独り言をモデルに書かせる。失敗したときは黙って雛形に戻る（運営が「エラーで止まる」のは
              世界の外の都合なので、画面には出さない）。
              {operatorError() ? ` 直近の失敗：${operatorError()}` : ''}
            </span>
          </>
        ) : (
          <span className="sub">鍵を持たなくても運営は動く。文体の規則は同じ。</span>
        )}
      </section>

      <section className="section">
        <div className="label">保存とオフライン</div>
        <span className="sub">
          {persistent ? 'IndexedDB に保存している。' : '保存できない（再読み込みで消える）。'}{' '}
          {registrationError() ?? (offlineReady() ? '圏外でも開く。' : '開発サーバでは Service Worker を登録しない。')}
        </span>
        {updateReady() ? (
          <button className="btn btn--ghost" type="button" onClick={applyUpdate}>
            新しい版に更新する
          </button>
        ) : null}
      </section>

      <section className="section">
        <div className="label">消去</div>
        {confirmWipe ? (
          <>
            <div className="notice">
              <div className="notice__title">Erase</div>
              指令・報告・裁定・布告、コミュニティの状態をすべて消す。取り消せない。
            </div>
            <button
              className="btn btn--accent"
              type="button"
              onClick={() => {
                void wipe().then(onReset);
              }}
            >
              すべて消す
            </button>
            <button className="btn btn--quiet" type="button" onClick={() => setConfirmWipe(false)}>
              やめる
            </button>
          </>
        ) : (
          <button className="btn btn--ghost" type="button" onClick={() => setConfirmWipe(true)}>
            すべての記録を消す
          </button>
        )}
      </section>
    </div>
  );
}
