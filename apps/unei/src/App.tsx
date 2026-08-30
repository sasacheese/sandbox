import { useEffect, useState } from 'react';
import { Chronicle } from './components/Chronicle.tsx';
import { Enroll } from './components/Enroll.tsx';
import { Gate } from './components/Gate.tsx';
import { Home } from './components/Home.tsx';
import { Laws } from './components/Laws.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { unlocked } from './lib/gate.ts';
import { moodTier } from './lib/mood.ts';
import { useStore } from './store.tsx';

export function App() {
  const { ready, me, realm, mood, open } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  // 解錠は端末ごと。合言葉を変えると（digest が変わると）全員が入口へ戻る
  const [entered, setEntered] = useState(() => unlocked());

  /*
   * 運営が決めた色を、世界そのものに反映する。
   *
   * CSS 変数を書き換えるだけだが、布告のあとに画面の色が実際に変わることが、
   * 「この運営には権限がある」といういちばん安い説明になっている。
   */
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', realm.accent);
  }, [realm.accent]);

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
        <Enroll />
      </div>
    );
  }

  return (
    <div className={`app${moodTier(mood) === 'dying' ? ' app--dying' : ''}`}>
      {tab === 'home' ? <Home /> : null}
      {tab === 'chronicle' ? <Chronicle /> : null}
      {tab === 'laws' ? <Laws /> : null}
      {tab === 'settings' ? <SettingsView onReset={() => setTab('home')} /> : null}
      <TabBar current={tab} onChange={setTab} alert={open !== null} />
    </div>
  );
}
