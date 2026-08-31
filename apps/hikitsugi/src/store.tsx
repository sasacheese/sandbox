/**
 * 状態。
 *
 * 画面はメッセンジャーなので、状態も**トークの配列ひとつ**に寄せてある。
 * 吹き出しは保存しない（トークの種類・経過・自分が打ったものから毎回組み立てる）。
 * 保存するのは、自分が打ったものと、判断と、既読の位置だけ。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from './lib/db.ts';
import { buildHandover, buildThreads } from './lib/generate.ts';
import { DEFAULT_DAY_MS, agentReplyText, bubblesOf, isReady } from './lib/threads.ts';
import { isoTime, type AskAnswer, type Decision, type Handover, type Intake, type Thread } from './lib/types.ts';

const KV_INTAKE = 'intake';
const KV_THREADS = 'threads';
const KV_SETTINGS = 'settings';

export type Settings = { dayMs: number };

const DEFAULT_SETTINGS: Settings = { dayMs: DEFAULT_DAY_MS };

export type Store = {
  ready: boolean;
  persistent: boolean;
  intake: Intake | null;
  threads: Thread[];
  settings: Settings;
  /** 画面を動かすための時計。 */
  now: Date;

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
  setDayMs: (dayMs: number) => Promise<void>;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => new Date());

  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  /*
   * 時計。
   *
   * 代理人のトークは開いていなくても進むので、一定間隔で now を配る。
   * 1 秒ごとにしているのは、既定の一日が 3 秒で、待っている実感が要るから。
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
      const [loadedIntake, loadedThreads, loadedSettings] = await Promise.all([
        db.readKv<Intake>(KV_INTAKE),
        db.readKv<Thread[]>(KV_THREADS),
        db.readKv<Settings>(KV_SETTINGS),
      ]);
      if (cancelled) return;
      setIntake(loadedIntake);
      // 前の版で保存したトークには answers が無いので補う
      if (loadedThreads) setThreads(loadedThreads.map((thread) => ({ ...thread, answers: thread.answers ?? {} })));
      if (loadedSettings) setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
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

  /** 一本だけ差し替える。続けて呼ばれても取りこぼさないよう ref から作る。 */
  const patch = useCallback(
    async (threadId: string, change: (thread: Thread) => Thread) => {
      const next = threadsRef.current.map((thread) => (thread.id === threadId ? change(thread) : thread));
      threadsRef.current = next;
      setThreads(next);
      await save(KV_THREADS, next);
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
       * 一本は満了、一本は途中、一本は始まったばかり。これから始まるのではなく、
       * もう進んでいたものを見せられる、という順序をここで作っている。
       */
      const nextThreads = buildThreads(at, Math.random);
      setIntake(nextIntake);
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      await save(KV_INTAKE, nextIntake);
      await save(KV_THREADS, nextThreads);
    },
    [save],
  );

  const send = useCallback(
    async (threadId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await patch(threadId, (thread) => ({
        ...thread,
        sent: [...thread.sent, { id: newId('me'), at: isoTime(new Date()), text: trimmed, byAgent: false }],
        /*
         * 自分で打つと親密度が下がる。
         *
         * 代理人のほうが返信が早く、相手の話を忘れず、言葉を選べる。
         * **人間には勝てない条件で築かれた関係**を引き継いだ結果がこれ。
         */
        delta: thread.decision === 'inherit' ? thread.delta - 8 : thread.delta,
      }));
    },
    [patch],
  );

  const delegate = useCallback(
    async (threadId: string) => {
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (!thread) return;
      const text = agentReplyText(thread);
      await patch(threadId, (current) => ({
        ...current,
        sent: [...current.sent, { id: newId('ag'), at: isoTime(new Date()), text, byAgent: true }],
        delta: current.decision === 'inherit' ? current.delta + 1 : current.delta,
      }));
    },
    [patch],
  );

  const markRead = useCallback(
    async (threadId: string) => {
      await patch(threadId, (thread) => ({ ...thread, readAt: isoTime(new Date()) }));
    },
    [patch],
  );

  const answerAsk = useCallback(
    async (threadId: string, askId: string, answer: AskAnswer) => {
      await patch(threadId, (thread) => ({ ...thread, answers: { ...thread.answers, [askId]: answer } }));
    },
    [patch],
  );

  const decide = useCallback(
    async (threadId: string, decision: Decision) => {
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const handover = thread && intake ? buildHandover(thread, intake) : null;
      /*
       * 双方が引き継いだときだけ、表題が伏せ名から氏名へ変わる。
       *
       * 一覧に実名が現れるのが引き継ぎの合図になる。片側だけの引き継ぎでは
       * 最後まで「A」のままで、申込書の条項（氏名は双方の希望があるときのみ
       * 開示）を実装が破らないようにしている。
       */
      const reveal = decision === 'inherit' && handover?.theirs === 'inherit';
      await patch(threadId, (current) => ({
        ...current,
        decision,
        ...(reveal && handover ? { title: handover.name } : {}),
        ...(decision === 'inherit' ? { inheritedAt: isoTime(new Date()) } : {}),
      }));
    },
    [intake, patch],
  );

  const setDayMs = useCallback(
    async (dayMs: number) => {
      const next = { ...settings, dayMs };
      setSettings(next);
      await save(KV_SETTINGS, next);
    },
    [save, settings],
  );

  const reset = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    setIntake(null);
    threadsRef.current = [];
    setThreads([]);
    setSettings(DEFAULT_SETTINGS);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const mine = threads.filter((t) => t.kind === 'plain' || t.decision === 'inherit');
    const proxies = threads.filter((t) => t.kind === 'proxy' && t.decision !== 'inherit');
    return {
      ready,
      persistent,
      intake,
      threads,
      settings,
      now,
      // 引き継いだものは新しいので上へ。自分のトークは最後のやり取りが古い順に下がる
      mine: [...mine].sort((a, b) => lastAt(b, now, settings.dayMs).localeCompare(lastAt(a, now, settings.dayMs))),
      proxies: [...proxies].sort((a, b) => (a.title < b.title ? -1 : 1)),
      handoverFor: (threadId) => {
        const thread = threads.find((t) => t.id === threadId);
        return thread && intake ? buildHandover(thread, intake) : null;
      },
      readyCount: proxies.filter((t) => isReady(t, now, settings.dayMs)).length,
      apply,
      send,
      delegate,
      markRead,
      answerAsk,
      decide,
      setDayMs,
      reset,
    };
  }, [answerAsk, apply, decide, delegate, intake, markRead, now, persistent, ready, reset, send, setDayMs, settings, threads]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function lastAt(thread: Thread, now: Date, dayMs: number): string {
  return bubblesOf(thread, now, dayMs).at(-1)?.at ?? '';
}
