import { useState } from 'react';
import { FeedView } from './components/FeedView.tsx';
import { Gate, Join } from './components/Enter.tsx';
import { Gatherings } from './components/Gatherings.tsx';
import { Residents } from './components/Residents.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { unlocked } from './lib/gate.ts';
import { useStore } from './store.tsx';

export function App() {
  const { ready, me } = useStore();
  const [entered, setEntered] = useState(() => unlocked());
  const [tab, setTab] = useState<Tab>('feed');

  if (!entered) {
    return (
      <div className="app">
        <Gate onOpen={() => setEntered(true)} />
      </div>
    );
  }

  if (!ready) return <div className="app" />;

  if (!me) {
    return (
      <div className="app">
        <Join />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === 'feed' ? <FeedView onOpenGatherings={() => setTab('gatherings')} /> : null}
      {tab === 'gatherings' ? <Gatherings /> : null}
      {tab === 'residents' ? <Residents /> : null}
      {tab === 'me' ? <SettingsView onReset={() => setTab('feed')} /> : null}
      <TabBar current={tab} onChange={setTab} />
    </div>
  );
}
