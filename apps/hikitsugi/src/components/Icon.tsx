/**
 * タブの絵記号。
 *
 * 文字（☰ ⧉ ⚙）で済ませていたが、端末によって太さも大きさも変わるので図形で描く。
 * 選ばれているタブは塗り、それ以外は線だけ——押せる場所がひと目で分かる形にする。
 */

export type IconName = 'friends' | 'talk' | 'proxy' | 'settings';

export function Icon({ name, on }: { name: IconName; on: boolean }) {
  const stroke = on ? 0 : 1.7;
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke}>
      {name === 'friends' ? <Friends /> : null}
      {name === 'talk' ? <Talk /> : null}
      {name === 'proxy' ? <Proxy on={on} /> : null}
      {name === 'settings' ? <Settings /> : null}
    </svg>
  );
}

/** 人の形。頭と肩だけの、いわゆる雪だるま。 */
function Friends() {
  return (
    <>
      <circle cx="12" cy="8" r="3.9" strokeLinejoin="round" />
      <path d="M4.6 20.2c0-3.9 3.3-6.4 7.4-6.4s7.4 2.5 7.4 6.4z" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** 吹き出し一つ。自分のトーク。 */
function Talk() {
  return <path d="M12 3.6c-4.9 0-8.9 3.3-8.9 7.5 0 2.5 1.4 4.7 3.6 6.1l-.8 3.6 3.9-2a11 11 0 0 0 2.2.2c4.9 0 8.9-3.4 8.9-7.6S16.9 3.6 12 3.6z" strokeLinecap="round" strokeLinejoin="round" />;
}

/**
 * 吹き出し二つ。代理のトーク。
 *
 * 自分の吹き出しが一つなのに対して、こちらは**二つが重なっている**——
 * どちらも自分ではない、というのが形として出る。
 */
function Proxy({ on }: { on: boolean }) {
  return (
    <>
      <path d="M15.2 2.9c-3.7 0-6.7 2.4-6.7 5.4 0 1.8 1 3.4 2.6 4.4l-.5 2.7 2.9-1.5c.5.1 1.1.2 1.7.2 3.7 0 6.7-2.5 6.7-5.5S18.9 2.9 15.2 2.9z" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8.4 9.9c-3.4 0-6.2 2.3-6.2 5.1 0 1.7 1 3.2 2.4 4.1l-.5 2.6 2.7-1.4c.5.1 1 .2 1.6.2 3.4 0 6.2-2.3 6.2-5.1s-2.8-5.5-6.2-5.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(on ? { fill: 'currentColor', stroke: 'var(--tab-cut)', strokeWidth: 1.6 } : {})}
      />
    </>
  );
}

/** つまみ。設定。 */
function Settings() {
  return (
    <>
      <path d="M3.5 7.5h17M3.5 16.5h17" strokeLinecap="round" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="7.5" r="2.6" fill="var(--tab-cut)" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.5" cy="16.5" r="2.6" fill="var(--tab-cut)" stroke="currentColor" strokeWidth="1.7" />
    </>
  );
}
