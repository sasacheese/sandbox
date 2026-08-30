import { useState } from 'react';
import { since } from '../lib/format.ts';
import type { Thread } from '../lib/feed.ts';
import { useStore } from '../store.tsx';
import { Avatar } from './Avatar.tsx';

/**
 * 投稿とその返信。
 *
 * 自分の投稿かどうかで枠の色がわずかに変わるだけで、書式は同じ。区別を強くすると
 * 「自分の投稿」という特別な欄ができてしまい、同じ場所に並んでいる感じが薄れる。
 */
export function PostCard({ thread, now }: { thread: Thread; now: Date }) {
  const { likes, toggleLike, reply, me } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const liked = likes.includes(thread.id);
  const count = thread.likes + (liked ? 1 : 0);

  return (
    <article className={`post${thread.mine ? ' post--mine' : ''}`}>
      <div className="post__head">
        <Avatar name={thread.author} />
        <span className="post__author">{thread.author}</span>
        <time className="post__time" dateTime={thread.at}>
          {since(thread.at, now)}
        </time>
      </div>

      <p className="post__body">{thread.body}</p>
      {thread.photo ? <img className="post__photo" src={thread.photo} alt="" /> : null}

      {thread.replies.length > 0 ? (
        <div className="replies">
          {thread.replies.map((item) => (
            <div className="reply" key={item.id}>
              <div className="reply__head">
                <Avatar name={item.author} small />
                <span className="reply__author">{item.author}</span>
                <time className="reply__time" dateTime={item.at}>
                  {since(item.at, now)}
                </time>
              </div>
              <p className="reply__body">{item.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="post__foot">
        <button type="button" className={`act${liked ? ' act--on' : ''}`} onClick={() => void toggleLike(thread.id)}>
          {liked ? '♥' : '♡'} {count > 0 ? count : ''}
        </button>
        <button type="button" className="act" onClick={() => setOpen((v) => !v)}>
          返信 {thread.replies.length > 0 ? thread.replies.length : ''}
        </button>
      </div>

      {open ? (
        <div className="replybox">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            placeholder={`${me?.handle ?? ''} として返信`}
            autoComplete="off"
          />
          <button
            className="btn"
            type="button"
            disabled={draft.trim() === ''}
            onClick={() => {
              void reply(thread.id, draft);
              setDraft('');
              setOpen(false);
            }}
          >
            送る
          </button>
        </div>
      ) : null}
    </article>
  );
}
