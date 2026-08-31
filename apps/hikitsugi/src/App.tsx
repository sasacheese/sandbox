import { useEffect, useRef, useState } from 'react';
import { Chat } from './components/Chat.tsx';
import { ChatList } from './components/ChatList.tsx';
import { Friends } from './components/Friends.tsx';
import { Gate } from './components/Gate.tsx';
import { HandoverSheet } from './components/HandoverSheet.tsx';
import { Import } from './components/Import.tsx';
import { Lab } from './components/Lab.tsx';
import { Settings } from './components/Settings.tsx';
import { TabBar, type Tab } from './components/TabBar.tsx';
import { unlocked } from './lib/gate.ts';
import { applyUpdate, subscribeUpdate, updateReady } from './lib/updates.ts';
import { bubblesOf, pendingAsksOf, unreadOf } from './lib/threads.ts';
import { useStore } from './store.tsx';

export function App() {
  const store = useStore();
  const [entered, setEntered] = useState(() => unlocked());
  const [tab, setTab] = useState<Tab>('mine');
  /*
   * 取り込みの画面を抜けたか。
   *
   * 読み込んだ直後に一覧へ飛ばすと、**集計の表を見せないまま先へ進んでしまう**。
   * あの表がこの作品の入口なので、押されるまで待つ。前回の取り込みが残って
   * いるときは、もう見ているので飛ばす。
   */
  const [past, setPast] = useState(false);
  const firstLoad = useRef(true);
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

  // 取り込みが済むまでは、まだメッセンジャーですらない
  if (firstLoad.current) {
    firstLoad.current = false;
    if (store.transcripts.length > 0) setPast(true);
  }

  if (!past) {
    return (
      <div className="app">
        <Import onDone={() => setPast(true)} />
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

  /*
   * タブの印は、**新着のあるトークの数**。
   *
   * 通数を足すと、代理のほうは数分で 99+ に張り付いて何も言わなくなる
   * （実際になった）。件数なら上限が相手の人数を超えないので、増えていることが
   * 最後まで読める。一通ずつの数は、一覧の行のほうに出ている。
   */
  const waiting = (kind: 'mine' | 'proxy'): number =>
    (kind === 'mine' ? store.mine : store.proxies).filter((thread) => {
      const bubbles = bubblesOf(thread, store.now);
      // 未回答の確認も新着に数える。放っておくと代理が埋めてしまうため
      return unreadOf(thread, bubbles) > 0 || pendingAsksOf(bubbles) > 0;
    }).length;

  return (
    <div className="app">
      <UpdateBar />
      {tab === 'mine' ? <ChatList kind="mine" onOpen={setOpenId} /> : null}
      {/* 代理応答をオンにするまで、このタブは機能の紹介でしかない */}
      {tab === 'proxy' ? store.lab ? <ChatList kind="proxy" onOpen={setOpenId} /> : <Lab /> : null}
      {tab === 'friends' ? <Friends onOpen={setOpenId} /> : null}
      {tab === 'settings' ? <Settings /> : null}
      <TabBar current={tab} onChange={setTab} badges={{ mine: waiting('mine'), proxy: store.lab ? waiting('proxy') : 0 }} />
    </div>
  );
}

/**
 * 新しい版が来たことの知らせ。
 *
 * 勝手に入れ替えない。眺めているあいだに画面が差し替わるのが困るので、押される
 * まで待つ。**ここが無いと、端末に入れたぶんは古い版のまま動き続ける。**
 */
function UpdateBar() {
  const [ready, setReady] = useState(() => updateReady());
  useEffect(() => subscribeUpdate(() => setReady(updateReady())), []);
  if (!ready) return null;

  return (
    <div className="updatebar">
      <span className="updatebar__text">新しい版があります。</span>
      <button type="button" className="updatebar__btn" onClick={() => applyUpdate()}>
        更新
      </button>
    </div>
  );
}
