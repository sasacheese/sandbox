import { useState } from 'react';
import { Chat } from './components/Chat.tsx';
import { ChatList } from './components/ChatList.tsx';
import { Friends } from './components/Friends.tsx';
import { Gate } from './components/Gate.tsx';
import { HandoverSheet } from './components/HandoverSheet.tsx';
import { Intake } from './components/Intake.tsx';
import { Settings } from './components/Settings.tsx';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { unlocked } from './lib/gate.ts';
import { bubblesOf, pendingAsksOf, unreadOf } from './lib/threads.ts';
import { useStore } from './store.tsx';

export function App() {
  const store = useStore();
  const [entered, setEntered] = useState(() => unlocked());
  const [tab, setTab] = useState<Tab>('mine');
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);

  if (!entered) {
    return (
      <div className="app">
        <Gate onOpen={() => setEntered(true)} />
      </div>
    );
  }

  if (!store.ready) return <div className="app" />;

  if (!store.intake) {
    return (
      <div className="app">
        <Intake />
      </div>
    );
  }

  const open = openId ? store.threads.find((t) => t.id === openId) : null;

  if (open) {
    return (
      <div className="app">
        <Chat thread={open} onBack={() => setOpenId(null)} onOpenHandover={() => setSheetId(open.id)} />
        {sheetId ? <HandoverSheet threadId={sheetId} onClose={() => setSheetId(null)} /> : null}
      </div>
    );
  }

  // 未読の合計。タブの右上に出す
  const unread = (kind: 'mine' | 'proxy'): number =>
    (kind === 'mine' ? store.mine : store.proxies).reduce((sum, thread) => {
      const bubbles = bubblesOf(thread, store.now);
      // 未回答の確認も数に入れる。放っておくと代理人が埋めてしまうため
      return sum + unreadOf(thread, bubbles) + pendingAsksOf(bubbles);
    }, 0);

  return (
    <div className="app">
      {tab === 'mine' ? <ChatList kind="mine" onOpen={setOpenId} /> : null}
      {tab === 'proxy' ? <ChatList kind="proxy" onOpen={setOpenId} /> : null}
      {tab === 'friends' ? <Friends onOpen={setOpenId} /> : null}
      {tab === 'settings' ? <Settings /> : null}
      <TabBar current={tab} onChange={setTab} badges={{ mine: unread('mine'), proxy: unread('proxy') }} />
    </div>
  );
}
