import { hueOf, initial } from '../lib/format.ts';

/**
 * 住人の顔。画像は持たせない。
 *
 * 名前から色相を決めて、頭文字を白抜きで置くだけ。全員が同じ作りなので、
 * 誰か一人だけ見た目で目立つことがない（自分も含めて）。
 */
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      className={`avatar${small ? ' avatar--sm' : ''}`}
      style={{ background: `hsl(${hueOf(name)} 42% 46%)` }}
      aria-hidden="true"
    >
      {initial(name)}
    </span>
  );
}
