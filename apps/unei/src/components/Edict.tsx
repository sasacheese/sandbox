import { countdown, clockTime } from '../lib/format.ts';
import type { Directive } from '../lib/types.ts';

/**
 * 高札。夜の画面に一枚だけ貼られる明るい面。
 *
 * 情報は 4 つだけ——いつ・どこで・何人・何をするか。書式を帳票に寄せず、
 * 本文を明朝で組んでいるのは、これが事務連絡ではなく**告知**だから。
 */
export function Edict({ directive, now, index }: { directive: Directive; now: Date; index: number }) {
  const { text, passed } = countdown(directive.gatherAt, now);
  return (
    <article className="edict">
      <div className="edict__head">
        <span className="edict__no">指令 #{`${index}`.padStart(3, '0')}</span>
        <span className="edict__when">{clockTime(directive.gatherAt, now)}</span>
      </div>

      <div className="edict__where">{directive.place}</div>

      <div className="edict__condition">{directive.condition}</div>

      <div className="edict__meta">
        <span>{directive.minPeople} 人以上</span>
        <span>{passed ? `集合時刻を ${text} 過ぎている` : `あと ${text}`}</span>
      </div>
    </article>
  );
}
