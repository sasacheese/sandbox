import { useState } from 'react';
import { Contacts, Pledges, Settings } from './components/After.tsx';
import { Gate } from './components/Gate.tsx';
import { HandoverView } from './components/HandoverView.tsx';
import { Intake } from './components/Intake.tsx';
import { Proxy } from './components/Proxy.tsx';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { unlocked } from './lib/gate.ts';
import { useStore } from './store.tsx';

export function App() {
  const { ready, phase, enter, messages, after, elapsed } = useStore();
  const [entered, setEntered] = useState(() => unlocked());
  const [tab, setTab] = useState<Tab>('contacts');

  if (!entered) {
    return (
      <div className="app">
        <Gate onOpen={() => setEntered(true)} />
      </div>
    );
  }

  if (!ready) return <div className="app" />;

  if (phase === 'intake') {
    return (
      <div className="app">
        <Intake />
      </div>
    );
  }

  if (phase === 'proxy') {
    return (
      <div className="app">
        <Proxy />
      </div>
    );
  }

  if (phase === 'handover') {
    return (
      <div className="app">
        <HandoverView onEnter={() => void enter()} />
      </div>
    );
  }

  // 未回答の確認の数。放っておくと溜まる
  const unread = messages.filter((m) => m.day <= elapsed && m.questionId && !after.answers[m.questionId]).length;

  return (
    <div className="app">
      {tab === 'contacts' ? <Contacts /> : null}
      {tab === 'handover' ? <HandoverView /> : null}
      {tab === 'pledges' ? <Pledges /> : null}
      {tab === 'settings' ? <Settings onReset={() => setTab('contacts')} /> : null}
      <TabBar current={tab} onChange={setTab} unread={unread} />
    </div>
  );
}
