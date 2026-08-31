/**
 * 状態。
 *
 * **トークは保存しない。**実演の時間割（lib/loop.ts）と現在時刻から毎回
 * 組み立てるので、開いていないあいだも交流は進み、開くたびに本数が増えている。
 * 端末に残すのは本人が触った跡だけ——打った文、確認への答え、判断、既読の位置。
 * 一巡ぶんを出し切ると跡は消え、同じ関係がもう一度、何も知らない状態から始まる。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from './lib/db.ts';
import { buildHandover, buildThreads, withState } from './lib/generate.ts';
import { DEFAULT_LOOP_MS, loopAt } from './lib/loop.ts';
import { agentReplyText, bubblesOf, isReady } from './lib/threads.ts';
import {
  isoTime,
  type AskAnswer,
  type Decision,
  type Handover,
  type Intake,
  type IsoTime,
  type Thread,
  type ThreadState,
} from './lib/types.ts';

const KV_INTAKE = 'intake';
const KV_SETTINGS = 'settings';
const KV_PROGRESS = 'progress';

export type Settings = {
  /** 一巡の長さ。 */
  loopMs: number;
  /** 一巡目が始まった時刻。ここからの経過で何巡目のどこにいるかが決まる。 */
  startedAt: IsoTime;
};

/** 本人が触った跡。一巡が終わると空になる。 */
export type Progress = { loop: number; states: Record<string, ThreadState> };

const EMPTY_PROGRESS: Progress = { loop: 0, states: {} };
const EMPTY_STATE: ThreadState = { sent: [], answers: {}, delta: 0 };

export type Store = {
  ready: boolean;
  persistent: boolean;
  intake: Intake | null;
  threads: Thread[];
  settings: Settings;
  /** 画面を動かすための時計。 */
  now: Date;
  /** いま何巡目のどこにいるか。 */
  loop: { index: number; phase: number; total: number };

  /** 自分のトーク（止まっているもの＋引き継いだもの）。 */
  mine: Thread[];
  /** 代理人のトーク（まだ引き継いでいないもの）。 */
  proxies: Thread[];

  handoverFor: (threadId: string) => Handover | null;
  readyCount: number;

  apply: (input: Omit<Intake, 'startedAt'>) => Promise<void>;
  send: (threadId: string, text: string) => Promise<void>;
  delegate: (threadId: string) => Promise<void>;
  markRead: (threadId: string) => Promise<void>;
  /** 代理人からの確認に答える。答えないと代理人が埋める。 */
  answerAsk: (threadId: string, askId: string, answer: AskAnswer) => Promise<void>;
  decide: (threadId: string, decision: Decision) => Promise<void>;
  setLoopMs: (loopMs: number) => Promise<void>;
  reset: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の外で useStore を呼んだ');
  return store;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function freshSettings(at: Date): Settings {
  return { loopMs: DEFAULT_LOOP_MS, startedAt: isoTime(at) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [settings, setSettings] = useState<Settings>(() => freshSettings(new Date()));
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [now, setNow] = useState(() => new Date());

  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  /*
   * 時計。
   *
   * 代理人のトークは開いていなくても進むので、一定間隔で now を配る。
   * 1 秒ごとにしているのは、一通が数秒おきに届くのを取りこぼさないため。
   */
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await db.isPersistent();
      if (cancelled) return;
      setPersistent(ok);
      if (!ok) return;
      db.requestPersistence().catch(() => undefined);
      const [loadedIntake, loadedSettings, loadedProgress] = await Promise.all([
        db.readKv<Intake>(KV_INTAKE),
        db.readKv<Partial<Settings>>(KV_SETTINGS),
        db.readKv<Progress>(KV_PROGRESS),
      ]);
      if (cancelled) return;
      setIntake(loadedIntake);
      // 前の版の設定には一巡の情報が無い。その場合はいまを一巡目の頭にする
      setSettings(
        loadedSettings?.startedAt && loadedSettings.loopMs
          ? { loopMs: loadedSettings.loopMs, startedAt: loadedSettings.startedAt }
          : freshSettings(new Date()),
      );
      if (loadedProgress?.states) setProgress(loadedProgress);
    })()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (key: string, value: unknown) => {
      if (persistent) await db.writeKv(key, value).catch(() => undefined);
    },
    [persistent],
  );

  const startedAt = new Date(settings.startedAt).getTime();
  const position = loopAt(now, startedAt, settings.loopMs);

  /*
   * 一巡の終わり。
   *
   * 出し切ったら跡を消して、また頭から始める。**引き継いだ関係も、答えた確認も
   * 残らない。**同じ相手と、同じところから、もう一度始まる。
   */
  useEffect(() => {
    if (!ready || !intake) return;
    if (position.index === progressRef.current.loop) return;
    const next: Progress = { loop: position.index, states: {} };
    progressRef.current = next;
    setProgress(next);
    void save(KV_PROGRESS, next);
  }, [intake, position.index, ready, save]);

  const threads = useMemo(() => {
    if (!intake) return [];
    return buildThreads(now, startedAt, settings.loopMs).map((thread) => withState(thread, progress.states[thread.id]));
  }, [intake, now, progress.states, settings.loopMs, startedAt]);

  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  /** 一本ぶんの跡を書き換える。続けて呼ばれても取りこぼさないよう ref から作る。 */
  const patch = useCallback(
    async (threadId: string, change: (state: ThreadState) => ThreadState) => {
      const current = progressRef.current;
      const next: Progress = {
        ...current,
        states: { ...current.states, [threadId]: change(current.states[threadId] ?? EMPTY_STATE) },
      };
      progressRef.current = next;
      setProgress(next);
      await save(KV_PROGRESS, next);
    },
    [save],
  );

  const apply = useCallback(
    async (input: Omit<Intake, 'startedAt'>) => {
      const at = new Date();
      const nextIntake: Intake = { ...input, startedAt: isoTime(at) };
      /*
       * 代理人のトークは、申込の時点で**すでに進んでいる**。
       *
       * 一本は満了、二本は途中。これから始まるのではなく、もう進んでいたものを
       * 見せられる、という順序をここで作っている。残りは眺めているあいだに増える。
       */
      const nextSettings = freshSettings(at);
      setIntake(nextIntake);
      setSettings(nextSettings);
      progressRef.current = EMPTY_PROGRESS;
      setProgress(EMPTY_PROGRESS);
      await save(KV_INTAKE, nextIntake);
      await save(KV_SETTINGS, nextSettings);
      await save(KV_PROGRESS, EMPTY_PROGRESS);
    },
    [save],
  );

  const send = useCallback(
    async (threadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await patch(threadId, (state) => ({
        ...state,
        sent: [...state.sent, { id: newId('me'), at: isoTime(new Date()), text: trimmed, byAgent: false }],
        /*
         * 自分で打つと親密度が下がる。
         *
         * 代理人のほうが返信が早く、相手の話を忘れず、言葉を選べる。
         * **人間には勝てない条件で築かれた関係**を引き継いだ結果がこれ。
         */
        delta: state.decision === 'inherit' ? state.delta - 8 : state.delta,
      }));
    },
    [patch],
  );

  const delegate = useCallback(
    async (threadId: string) => {
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (!thread) return;
      const text = agentReplyText(thread);
      await patch(threadId, (state) => ({
        ...state,
        sent: [...state.sent, { id: newId('ag'), at: isoTime(new Date()), text, byAgent: true }],
        delta: state.decision === 'inherit' ? state.delta + 1 : state.delta,
      }));
    },
    [patch],
  );

  const markRead = useCallback(
    async (threadId: string) => {
      await patch(threadId, (state) => ({ ...state, readAt: isoTime(new Date()) }));
    },
    [patch],
  );

  const answerAsk = useCallback(
    async (threadId: string, askId: string, answer: AskAnswer) => {
      await patch(threadId, (state) => ({ ...state, answers: { ...state.answers, [askId]: answer } }));
    },
    [patch],
  );

  const decide = useCallback(
    async (threadId: string, decision: Decision) => {
      await patch(threadId, (state) => ({
        ...state,
        decision,
        ...(decision === 'inherit' ? { inheritedAt: isoTime(new Date()) } : {}),
      }));
    },
    [patch],
  );

  const setLoopMs = useCallback(
    async (loopMs: number) => {
      // 速さを変えたら一巡目の頭から。途中で伸縮させると進行が飛ぶ
      const next = freshSettings(new Date());
      next.loopMs = loopMs;
      setSettings(next);
      progressRef.current = EMPTY_PROGRESS;
      setProgress(EMPTY_PROGRESS);
      await save(KV_SETTINGS, next);
      await save(KV_PROGRESS, EMPTY_PROGRESS);
    },
    [save],
  );

  const reset = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    setIntake(null);
    setSettings(freshSettings(new Date()));
    progressRef.current = EMPTY_PROGRESS;
    setProgress(EMPTY_PROGRESS);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const mine = threads.filter((t) => t.kind === 'plain' || t.decision === 'inherit');
    const proxies = threads.filter((t) => t.kind === 'proxy' && t.decision !== 'inherit');
    // 新しいやり取りが上へ。届いた瞬間に一覧が動くので、放置していても賑やか
    const byActivity = (a: Thread, b: Thread) => lastAt(b, now).localeCompare(lastAt(a, now));
    return {
      ready,
      persistent,
      intake,
      threads,
      settings,
      now,
      loop: { index: position.index, phase: position.phase, total: settings.loopMs },
      mine: [...mine].sort(byActivity),
      proxies: [...proxies].sort(byActivity),
      handoverFor: (threadId) => {
        const thread = threads.find((t) => t.id === threadId);
        return thread && intake ? buildHandover(thread, intake) : null;
      },
      readyCount: proxies.filter((t) => isReady(t, now)).length,
      apply,
      send,
      delegate,
      markRead,
      answerAsk,
      decide,
      setLoopMs,
      reset,
    };
  }, [
    answerAsk,
    apply,
    decide,
    delegate,
    intake,
    markRead,
    now,
    persistent,
    position.index,
    position.phase,
    ready,
    reset,
    send,
    setLoopMs,
    settings,
    threads,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function lastAt(thread: Thread, now: Date): string {
  return bubblesOf(thread, now).at(-1)?.at ?? '';
}
