export type Tab = 'home' | 'chronicle' | 'laws' | 'settings';

const TABS: readonly { id: Tab; name: string }[] = [
  { id: 'home', name: '指令' },
  { id: 'chronicle', name: '年代記' },
  { id: 'laws', name: '掟' },
  { id: 'settings', name: '設定' },
];

/** タブ。明朝の漢字だけで並べる。アイコンを付けるとアプリらしくなりすぎる。 */
export function TabBar({ current, onChange, alert }: { current: Tab; onChange: (tab: Tab) => void; alert: boolean }) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab${tab.id === current ? ' tab--on' : ''}`}
          aria-current={tab.id === current}
          onClick={() => onChange(tab.id)}
        >
          {tab.name}
          {tab.id === 'home' && alert ? <span className="tab__dot" aria-hidden="true" /> : null}
        </button>
      ))}
    </nav>
  );
}
