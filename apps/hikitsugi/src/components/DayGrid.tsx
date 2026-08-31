/**
 * 交流期間を点で並べる。一点が一日。
 *
 * 「14 日」と書くより、点が 14 個あることの方が早い。90 日を選ぶと画面が
 * 点で埋まり、**それだけの時間を他人が使った**ことが数える前に分かる。
 * 一行 7 点にしてあるのは、週の区切りとして読めるため。
 */
export function DayGrid({ days, filled, marks }: { days: number; filled: number; marks?: readonly number[] }) {
  const rows: number[][] = [];
  for (let day = 1; day <= days; day += 7) {
    rows.push(Array.from({ length: Math.min(7, days - day + 1) }, (_, i) => day + i));
  }

  return (
    <div className="daygrid" role="img" aria-label={`交流期間 ${days} 日のうち ${filled} 日が経過`}>
      {rows.map((row) => (
        <div className="daygrid__row" key={row[0]}>
          {row.map((day) => (
            <span
              key={day}
              className={[
                'daygrid__dot',
                day <= filled ? 'daygrid__dot--on' : '',
                marks?.includes(day) ? 'daygrid__dot--mark' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
