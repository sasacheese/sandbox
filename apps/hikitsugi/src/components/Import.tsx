import { useRef, useState } from 'react';
import { digestOf, byQuiet } from '../lib/transcript.ts';
import { SAMPLE_TRANSCRIPTS } from '../lib/sample.ts';
import { useStore } from '../store.tsx';

/**
 * トーク履歴の取り込み。最初の画面。
 *
 * ここで名前も相手も接点も決まるので、**質問する欄はひとつも要らない**。
 * 書き出しの中にもう書いてある。
 *
 * 読むのは LINE の「トーク履歴を送信」が吐く .txt。実在の機能で、実在の書式。
 * 自分のぶんを選んでもいいし、同梱の見本で試してもいい。**どちらでも、
 * 端末の外へは出ない。**
 */
export function Import({ onDone }: { onDone: () => void }) {
  const { importTexts, transcripts, now } = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  const take = async (texts: string[]) => {
    setBusy(true);
    const read = await importTexts(texts);
    setFailed(texts.length - read);
    setBusy(false);
  };

  const digests = transcripts.map((t) => digestOf(t, now)).filter((d) => d !== null).sort(byQuiet);

  if (digests.length > 0) {
    return (
      <div className="enter">
        <div className="label">読み込みました</div>
        <div className="cover__title">
          {digests.length} 件の
          <br />
          トークがありました。
        </div>
        <p className="doc" style={{ fontSize: '14px' }}>
          どれも、最後のやり取りから時間が経っています。
          {failed > 0 ? `（${failed} 件は読めなかったので飛ばしました）` : ''}
        </p>

        <div className="ledger">
          {digests.map((digest) => (
            <div className="ledger__row" key={digest.name}>
              <span className="ledger__name">{digest.name}</span>
              <span className="ledger__last">{new Date(digest.lastAt).toLocaleDateString('ja-JP')}</span>
              <span className="ledger__quiet num">{digest.quietDays} 日前</span>
              <span className="ledger__count num">{digest.count} 通</span>
            </div>
          ))}
        </div>

        <p className="sub" style={{ marginTop: '14px' }}>
          この表は集計しただけのものです。何も足していません。
        </p>

        <button className="btn" type="button" onClick={onDone}>
          続ける
          <span className="btn__hint">CONTINUE</span>
        </button>
      </div>
    );
  }

  return (
    <div className="enter">
      <div className="label">トーク履歴の取り込み</div>
      <div className="cover__title">
        誰と話さなく
        <br />
        なったかを見ます。
      </div>
      <p className="doc" style={{ fontSize: '14px' }}>
        LINE の「トーク履歴を送信」で書き出した .txt を選んでください。
        <br />
        読み込んだものは<strong>この端末から出ません</strong>。送信も保存もしません。
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
          await take(await Promise.all(files.map((f) => f.text())));
          e.target.value = '';
        }}
      />

      <button className="btn" type="button" disabled={busy} onClick={() => file.current?.click()}>
        ファイルを選ぶ
        <span className="btn__hint">SELECT</span>
      </button>

      <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => void take([...SAMPLE_TRANSCRIPTS])}>
        見本の履歴で試す（12 件）
      </button>

      {failed > 0 ? <p className="sub">{failed} 件は書式が読めませんでした。</p> : null}

      <div className="terms">
        <div className="note">
          <span className="note__no">01</span>
          <span>読み込むのは本文と時刻と送信者だけです。写真・スタンプ・通話は書き出しに残らないため扱えません。</span>
        </div>
        <div className="note">
          <span className="note__no">02</span>
          <span>お名前は入力していただきません。書き出しの中に書かれているものを使います。</span>
        </div>
      </div>
    </div>
  );
}
