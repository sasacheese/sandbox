import { useState } from 'react';
import { toDataUrl } from '../lib/image.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/** 書き込む欄。写真は端末の中だけに残る。 */
export function Composer() {
  const { me, write } = useStore();
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  return (
    <div className="composer">
      <div className="row">
        <Avatar name={me?.handle ?? ''} small />
        <span className="label">{me?.handle}</span>
      </div>
      <textarea
        className="textarea"
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 400))}
        placeholder="今日どこを歩きましたか"
      />
      {photo ? <img className="post__photo" src={photo} alt="" /> : null}
      <div className="row row--end">
        <label className="act filepick">
          写真
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void toDataUrl(file).then(setPhoto).catch(() => undefined);
            }}
          />
        </label>
        {photo ? (
          <button type="button" className="act" onClick={() => setPhoto(null)}>
            外す
          </button>
        ) : null}
        <button
          className="btn"
          type="button"
          disabled={body.trim() === ''}
          onClick={() => {
            void write({ body, ...(photo ? { photo } : {}) });
            setBody('');
            setPhoto(null);
          }}
        >
          書き込む
        </button>
      </div>
    </div>
  );
}
