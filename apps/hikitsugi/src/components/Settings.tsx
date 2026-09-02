import { useRef, useState } from 'react';
import { FEEL_LABEL } from '../lib/agent.ts';
import { dateLabel } from '../lib/format.ts';
import { LOOP_PRESETS } from '../lib/loop.ts';
import { useStore } from '../store.tsx';

/** 設定。作品の外側の都合だけ置く。作り込まない。 */
export function Settings() {
  const {
    settings,
    setLoopMs,
    setOpenToAll,
    reset,
    persistent,
    intake,
    threads,
    loop,
    transcripts,
    own,
    lab,
    disableLab,
    appendTexts,
    seeds,
    startInherited,
    feelings,
  } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [added, setAdded] = useState<number | null>(null);
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
            <span className="section__title">トーク履歴を追加</span>
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
            トーク履歴を追加
          </button>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">02</span>
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
            {generated > 0 ? (
              <div className="kv">
                <span className="kv__key">履歴から作った代理</span>
                <span className="kv__value num">{generated} 人</span>
              </div>
            ) : null}
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

          {/*
            「引き継げた感じ、する？」への答え。**作品は判定を持たない**ので、
            ここに残るのは答えだけ。一周が終わっても消えない。
          */}
          {feelings.length > 0 ? (
            <>
              <span className="field__key" style={{ marginTop: '18px' }}>
                引き継げた感じ、する？
              </span>
              <div className="cover__rows">
                {[...feelings].reverse().map((feeling) => (
                  <div className="kv" key={`${feeling.at}-${feeling.threadId}`}>
                    <span className="kv__key">
                      {dateLabel(feeling.at)} · {feeling.name}
                    </span>
                    <span className="kv__value">{FEEL_LABEL[feeling.answer]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        {lab ? (
          <section className="section">
            <div className="section__head">
              <span className="section__no">03</span>
              <span className="section__title">未対応の相手にも代理を送る</span>
            </div>
            <p className="sub">
              既定では、代理を出せるのは相手も代理応答をオンにしている人だけです。オンにすると「未対応」の相手にも代理を送れます。相手は人間なので、返ってくるのは人間の返事です。このトークが自動応答であることは最初に表示されますが、相手はそれに触れません。
            </p>
            <div className="choices">
              <button type="button" className={`opt${settings.openToAll ? '' : ' opt--on'}`} onClick={() => void setOpenToAll(false)}>
                オフ
              </button>
              <button type="button" className={`opt${settings.openToAll ? ' opt--on' : ''}`} onClick={() => void setOpenToAll(true)}>
                オン
              </button>
            </div>
          </section>
        ) : null}

        {lab ? (
          <section className="section">
            <div className="section__head">
              <span className="section__no">04</span>
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
            <span className="section__no">{lab ? '05' : '03'}</span>
            <span className="section__title">記録を消す</span>
          </div>
          <p className="sub">取り込んだ履歴も、代理のやり取りも消えます。消しても、相手の記憶は残ります。</p>
          <button className="btn btn--ghost" type="button" onClick={() => void reset()}>
            すべて消して最初から
          </button>
        </section>

        <section className="section">
          <div className="section__head">
            <span className="section__no">{lab ? '06' : '04'}</span>
            <span className="section__title">デモ用設定</span>
          </div>
          <span className="field__key">一周の長さ</span>
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
            作品として見せるための項目です。代理のトークは順に出てきて順に終わり、全部出し切ると最初に戻ります（引き継いだ相手も、答えた確認も残りません）。
            短くするほど一通ごとの間隔が詰まります。変えると一周目の最初から始まります。
          </span>

          {lab ? (
            <>
              <span className="field__key" style={{ marginTop: '18px' }}>
                引き継いだ状態から始める
              </span>
              <div className="choices">
                {seeds
                  .filter((seed) => transcripts.some((t) => t.name === seed.name))
                  .map((seed) => {
                    const thread = threads.find((t) => t.seedId === seed.id);
                    const done = thread?.decision === 'inherit';
                    return (
                      <button
                        key={seed.id}
                        type="button"
                        className={`opt${done ? ' opt--on' : ''}`}
                        disabled={done}
                        onClick={() => void startInherited(seed.id)}
                      >
                        {seed.name}
                      </button>
                    );
                  })}
              </div>
              <span className="sub">
                押した相手は、その場で引き継ぎ済みになってトークへ移ります。やり取りは出し切った状態で、相手側がどうしたかは決めません。一周が終わると元に戻ります。
              </span>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
