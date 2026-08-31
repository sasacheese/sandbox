import { Icon, type IconName } from './Icon.tsx';

export type Tab = 'friends' | 'mine' | 'proxy' | 'settings';

/** 友達がいちばん左。開いていちばん先に目に入る場所へ置く。 */
const TABS: readonly { id: Tab; icon: IconName; name: string }[] = [
  { id: 'friends', icon: 'friends', name: '友達' },
  { id: 'mine', icon: 'talk', name: 'トーク' },
  { id: 'proxy', icon: 'proxy', name: '代理' },
  { id: 'settings', icon: 'settings', name: '設定' },
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
        const on = tab.id === current;
        return (
          <button key={tab.id} type="button" className={`tab${on ? ' tab--on' : ''}`} aria-current={on} onClick={() => onChange(tab.id)}>
            <span className="tab__glyph">
              <Icon name={tab.icon} on={on} />
              {badge > 0 ? <span className="tab__dot">{badge > 99 ? '99+' : badge}</span> : null}
            </span>
            <span className="tab__name">{tab.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
