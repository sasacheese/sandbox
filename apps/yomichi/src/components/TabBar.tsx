export type Tab = 'feed' | 'gatherings' | 'residents' | 'me';

const TABS: readonly { id: Tab; mark: string; name: string }[] = [
  { id: 'feed', mark: '☰', name: '流れ' },
  { id: 'gatherings', mark: '◎', name: '集まり' },
  { id: 'residents', mark: '⚇', name: '住人' },
  { id: 'me', mark: '⚙', name: '自分' },
];

export function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
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
          <span className="tab__mark" aria-hidden="true">
            {tab.mark}
          </span>
          {tab.name}
        </button>
      ))}
    </nav>
  );
}
