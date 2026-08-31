import { useEffect, useState } from 'react';

/**
 * 一定間隔で「今」を配る。
 *
 * カウントダウンは 1 秒ごと、それ以外は 30 秒ごとで足りる。復帰時にすぐ合わせるため、
 * visibilitychange でも更新する（眠っているあいだ setInterval は走らない）。
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
