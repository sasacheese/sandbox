import { useRef, useState } from 'react';
import { LOOP_PRESETS } from '../lib/loop.ts';
import { useStore } from '../store.tsx';

/** 設定。作品の外側の都合だけ置く。作り込まない。 */
export function Settings() {
  const { settings, setLoopMs, reset, persistent, intake, threads, loop, transcripts, own, lab, disableLab, appendTexts, api, setApi, seeds } =
    useStore();
  const file = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [key, setKey] = useState(api.key);
  const [model, setModel] = useState(api.model);
  const generated = seeds.filter((seed) => seed.generated).length;
  const inherited = threads.filter((t) => t.decision === 'inherit').length;
  const agentSent = threads.reduce((n, t) => n + t.sent.filter((s) => s.byAgent).length, 0);
  const selfSent = threads.reduce((n, t) => n + t.sent.filter((s) => !s.byAgent).length, 0);

  return (
    <>
      <header className="listhead">
        <span className="listhead__title">設定</span>
      </header>

      <div className="pad">
        <section className="section">
          <div className="section__head">
            <span className="section__no">01</span>
            <span className="section__title">一周の長さ</span>
          </div>
          <div className="choices">
            {LOOP_PRESETS.map((preset) => (
              <button
                key={preset.ms}
                type="button"
                className={`opt${settings.loopMs === preset.ms ? ' opt--on' : ''}`}
                onClick={() => void setLoopMs(preset.ms)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <span className="sub">
            代理のトークは九本あり、順に出てきて順に終わります。全部出し切ると最初に戻り、引き継いだ相手も、答えた確認も残りません。
            短くするほど一通ごとの間隔が詰まります。変えると一周目の最初から始まります。
          </span>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">02</span>
            <span className="section__title">トーク履歴を足す</span>
          </div>
          <p className="sub">
            LINE の「トーク履歴を送信」で書き出した .txt を追加できます。同じ相手のものは差し替えます。端末の外へは出ません。
            {added !== null ? `　${added} 件を読み込みました。` : ''}
          </p>
          <input
            ref={file}
            type="file"
            accept=".txt,text/plain"
            multiple
            hidden
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length === 0) return;
              setAdded(await appendTexts(await Promise.all(files.map((f) => f.text()))));
              e.target.value = '';
            }}
          />
          <button className="btn btn--ghost" type="button" onClick={() => file.current?.click()}>
            ファイルを選んで足す
          </button>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">03</span>
            <span className="section__title">代理のやり取りを作る</span>
          </div>
          <p className="sub">
            取り込んだ相手には台本がありません。モデルの鍵を入れると、友達の一覧から、その人の過去ログを読んで代理のやり取りを作れます。
            鍵はこの端末にだけ置き、送る先はモデルの API だけです。
            {generated > 0 ? `　いま ${generated} 人ぶんを作ってあります。` : ''}
          </p>
          <div className="field">
            <span className="field__key">OpenAI API キー</span>
            <input
              className="input input--key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <span className="field__key">モデル</span>
            <div className="field__row">
              <input className="input input--key" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
              <button className="btn btn--ghost" type="button" style={{ flex: 'none', width: 'auto', padding: '0 16px' }} onClick={() => void setApi({ key, model })}>
                保存
              </button>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">04</span>
            <span className="section__title">記録</span>
          </div>
          <div className="cover__rows">
            <div className="kv">
              <span className="kv__key">いまの位置</span>
              <span className="kv__value num">
                {loop.index + 1} 周目 · {Math.floor(loop.phase / 60_000)} / {Math.round(loop.total / 60_000)} 分
              </span>
            </div>
            <div className="kv">
              <span className="kv__key">あなた</span>
              <span className="kv__value">{own ?? '—'}（履歴から）</span>
            </div>
            <div className="kv">
              <span className="kv__key">読み込んだ履歴</span>
              <span className="kv__value num">
                {transcripts.length} 件 · {transcripts.reduce((n, t) => n + t.messages.length, 0)} 通
              </span>
            </div>
            <div className="kv">
              <span className="kv__key">代理応答</span>
              <span className="kv__value">{lab ? `オン（${intake?.persona ?? 0}）` : 'オフ'}</span>
            </div>
            <div className="kv">
              <span className="kv__key">引き継いだ相手</span>
              <span className="kv__value num">{inherited} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">自分で送った返信</span>
              <span className="kv__value num">{selfSent} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">代理にまかせた返信</span>
              <span className="kv__value num">{agentSent} 件</span>
            </div>
            <div className="kv">
              <span className="kv__key">保存</span>
              <span className="kv__value">{persistent ? 'この端末に保存しています' : '保存できません'}</span>
            </div>
          </div>
        </section>

        {lab ? (
          <section className="section">
            <div className="section__head">
              <span className="section__no">05</span>
              <span className="section__title">代理応答をやめる</span>
            </div>
            <p className="sub">
              オフにすると、代理が続けていたやり取りは残りません。相手には知らされません。
            </p>
            <button className="btn btn--ghost" type="button" onClick={() => void disableLab()}>
              代理応答をオフにする
            </button>
          </section>
        ) : null}

        <section className="section">
          <div className="section__head">
            <span className="section__no">{lab ? '06' : '05'}</span>
            <span className="section__title">記録を消す</span>
          </div>
          <p className="sub">取り込んだ履歴も、代理のやり取りも消えます。消しても、相手の記憶は残ります。</p>
          <button className="btn btn--ghost" type="button" onClick={() => void reset()}>
            すべて消して最初から
          </button>
        </section>
      </div>
    </>
  );
}
