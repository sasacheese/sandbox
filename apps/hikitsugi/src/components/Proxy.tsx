import { useEffect, useState } from 'react';
import { PROXY_LINES } from '../lib/pools.ts';
import { MS_PER_PROXY_DAY, useStore } from '../store.tsx';
import { Chart } from './Chart.tsx';
import { DayGrid } from './DayGrid.tsx';
import { Exchanges } from './Exchanges.tsx';
import { Ribbon } from './Ribbon.tsx';

/**
 * 交流期間。本人は何もしない。
 *
 * 相手は「A」としか表示されない。名前も写真も出ない。**誰と親しくなって
 * いるのかを知らないまま、親密度だけが上がっていく**のを見せる。
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
  const { counterpart } = handover;
  const shown = handover.exchanges.filter((e) => e.day <= day).slice(-4);
  const line = PROXY_LINES[day % PROXY_LINES.length] ?? '交流を継続。';

  return (
    <div className="screen screen--flow">
      <header className="brand">
        <span className="brand__name">関係引継サービス</span>
        <span className="brand__no">交流中 / IN CONTACT</span>
      </header>

      <Ribbon proxyDays={intake.days} proxyFilled={day} elapsed={0} horizon={14} />

      <div className="proxy">
        <div>
          <div className="proxy__day">{`${day}`.padStart(2, '0')}</div>
          <div className="proxy__of">
            / {intake.days} 日　あなたの代理人 と {counterpart.alias} の代理人
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DayGrid days={intake.days} filled={intake.watch ? day : 0} />
        </div>

        {intake.watch ? (
          <>
            <p className="proxy__line">{line}</p>
            <Chart
              people={[
                {
                  id: counterpart.id,
                  name: counterpart.alias,
                  metDay: 1,
                  inherited: counterpart.closeness,
                  current: counterpart.closeness,
                },
              ]}
              proxyDays={intake.days}
              proxyFilled={day}
              elapsed={0}
              horizon={14}
            />
            {shown.length > 0 ? <Exchanges exchanges={shown} alias={counterpart.alias} /> : null}
          </>
        ) : (
          <div className="sealed">
            記録は封をしています。
            <br />
            引き渡しのときに開きます。
          </div>
        )}

        <p className="sub">{done ? '交流期間が終了しました。' : `${intake.name} として交流しています。`}</p>
      </div>

      <button className="btn" type="button" disabled={!done} onClick={() => void receive()}>
        {done ? '引継書を受け取る' : '交流中'}
        <span className="btn__hint">{done ? 'RECEIVE' : `${intake.days - day} DAYS LEFT`}</span>
      </button>
    </div>
  );
}
