export type Tab = 'contacts' | 'handover' | 'pledges' | 'settings';

const TABS: readonly { id: Tab; name: string }[] = [
  { id: 'contacts', name: '連絡' },
  { id: 'handover', name: '引継書' },
  { id: 'pledges', name: '約束' },
  { id: 'settings', name: '設定' },
];

export function TabBar({ current, onChange, unread }: { current: Tab; onChange: (tab: Tab) => void; unread: number }) {
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
          {tab.id === 'contacts' && unread > 0 ? <span className="tab__badge">{unread}</span> : null}
        </button>
      ))}
    </nav>
  );
}
