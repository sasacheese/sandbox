import { useState } from 'react';
import { toDataUrl } from '../lib/image.ts';
import type { Directive } from '../lib/types.ts';
import { useStore } from '../store.tsx';

/**
 * 報告。祭りが行われたことを運営に届ける唯一の手立て。
 *
 * 入力できるのは人数・一言・写真だけ。「条件を守れたか」を自己申告させないのは、
 * 判定の基準を運営の側に残しておくため。何が見られているのか分からない方がいい。
 */
export function Report({ directive }: { directive: Directive }) {
  const { report, thinking } = useStore();
  const [people, setPeople] = useState(directive.minPeople);
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="section">
      <div className="label">報告</div>

      <div className="stepper">
        <button className="chip" type="button" onClick={() => setPeople((n) => Math.max(1, n - 1))}>
          −
        </button>
        <span className="stepper__value">{people}</span>
        <button className="chip" type="button" onClick={() => setPeople((n) => Math.min(99, n + 1))}>
          ＋
        </button>
        <span className="sub">集まった人数</span>
      </div>

      <textarea
        className="textarea"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 140))}
        placeholder="何が起きたか（一言）"
      />

      {imageUrl ? (
        <>
          <img className="photo" src={imageUrl} alt="" />
          <button className="btn btn--quiet" type="button" onClick={() => setImageUrl(null)}>
            写真を外す
          </button>
        </>
      ) : (
        <input
          className="input"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void toDataUrl(file).then(setImageUrl).catch(() => undefined);
          }}
        />
      )}

      <button
        className="btn btn--accent"
        type="button"
        disabled={busy || thinking}
        onClick={() => {
          setBusy(true);
          void report(directive.id, { people, note, ...(imageUrl ? { imageUrl } : {}) }).finally(() => setBusy(false));
        }}
      >
        {busy || thinking ? '運営が読んでいる' : '報告する'}
        <span className="btn__hint">SUBMIT</span>
      </button>
    </section>
  );
}
