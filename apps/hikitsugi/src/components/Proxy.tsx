import { useEffect, useState } from 'react';
import { MS_PER_PROXY_DAY, useStore } from '../store.tsx';
import { Chart } from './Chart.tsx';
import { DayGrid } from './DayGrid.tsx';
import { Ribbon } from './Ribbon.tsx';

/**
 * 代行期間。
 *
 * 本人は何もしない。**待つだけ**という時間をここに置いているのは、
 * 関係が自分の手を離れたところで作られていく感じを、体験として通すため。
 *
 * 引継書の中身はすでに決まっている（申込の時点で組み立ててある）。ここで
 * 流れているのは、決まったものを一日ずつ開示しているだけ。見ない設定を
 * 選んだ人には、同じ時間だけ封をした画面を見せる。
 */
export function Proxy() {
  const { intake, handover, receive } = useStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!intake) return;
    const start = new Date(intake.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / MS_PER_PROXY_DAY));
    tick();
    const timer = setInterval(tick, 120);
    return () => clearInterval(timer);
  }, [intake]);

  if (!intake || !handover) return null;
  const day = Math.min(elapsed, intake.days);
  const done = elapsed >= intake.days;
  const shown = handover.log.slice(Math.max(0, day - 3), day);
  const people = handover.companions.map((c) => ({
    id: c.id,
    name: c.name,
    metDay: c.metDay,
    inherited: c.closeness,
    current: c.closeness,
  }));

  return (
    <div className="screen screen--flow">
      <header className="brand">
        <span className="brand__name">関係引継サービス</span>
        <span className="brand__no">代行中 / IN PROXY</span>
      </header>

      <Ribbon proxyDays={intake.days} proxyFilled={day} elapsed={0} horizon={14} />

      <div className="proxy">
        <div>
          <div className="proxy__day">{`${day}`.padStart(2, '0')}</div>
          <div className="proxy__of">
            / {intake.days} 日　{handover.community}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DayGrid days={intake.days} filled={intake.watch ? day : 0} />
        </div>

        {intake.watch ? (
          <div className="proxy__line">
            {shown.map((entry) => (
              <div key={entry.day}>{entry.text}</div>
            ))}
          </div>
        ) : (
          <div className="sealed">
            記録は封をしています。
            <br />
            引き渡しのときに開きます。
          </div>
        )}

        {intake.watch ? (
          <Chart people={people} proxyDays={intake.days} proxyFilled={day} elapsed={0} horizon={14} />
        ) : null}

        <p className="sub">
          {done ? '代行期間が終了しました。' : `${intake.name} として参加しています。`}
        </p>
      </div>

      <button className="btn" type="button" disabled={!done} onClick={() => void receive()}>
        {done ? '引継書を受け取る' : '代行中'}
        <span className="btn__hint">{done ? 'RECEIVE' : `${intake.days - day} DAYS LEFT`}</span>
      </button>
    </div>
  );
}
