import { hueOf, initial } from '../lib/format.ts';

export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar${small ? ' avatar--sm' : ''}`} style={{ background: `hsl(${hueOf(name)} 24% 42%)` }} aria-hidden="true">
      {initial(name)}
    </span>
  );
}
