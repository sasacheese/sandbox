/**
 * 図に使う色の帯の定義。
 *
 * 顔の環と年表の線は SVG で描くので、色の帯をどこかに一つ置いておく必要がある。
 * **画面の枝ごとに置き忘れると、その画面だけ線が消える**（実際に引継書で消えた）。
 * ここは根に一つだけ置く。
 */
export function Defs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ringGradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--proxy)" />
          <stop offset="100%" stopColor="var(--proxy-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
