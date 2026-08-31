export type Tab = 'mine' | 'proxy' | 'friends' | 'settings';

const TABS: readonly { id: Tab; mark: string; name: string }[] = [
  { id: 'mine', mark: '☰', name: 'トーク' },
  { id: 'proxy', mark: '⧉', name: '代理' },
  { id: 'friends', mark: '⌾', name: '友達' },
  { id: 'settings', mark: '⚙', name: '設定' },
];

export function TabBar({
  current,
  onChange,
  badges,
}: {
  current: Tab;
  onChange: (tab: Tab) => void;
  badges: Partial<Record<Tab, number>>;
}) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => {
        const badge = badges[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab${tab.id === current ? ' tab--on' : ''}`}
            aria-current={tab.id === current}
            onClick={() => onChange(tab.id)}
          >
            <span className="tab__mark" aria-hidden="true">
              {tab.mark}
            </span>
            {tab.name}
            {badge > 0 ? <span className="tab__dot">{badge > 99 ? '99+' : badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
