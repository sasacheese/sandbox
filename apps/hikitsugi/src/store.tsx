/**
 * 状態。
 *
 * 申込 → 代行 → 引き継ぎ → その後、の一本道。戻れる場所は無い（引継書を
 * 受け取らない選択も、受け取ってから捨てる選択も用意していない）。
 * このサービスに解約が無いことが、作品としての言い分。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { messages as buildMessages, questions as buildQuestions, CLOSENESS_ON_RIGHT, CLOSENESS_ON_WRONG, type Message, type Question } from './lib/after.ts';
import { effectiveCloseness, inheritedCloseness } from './lib/closeness.ts';
import * as db from './lib/db.ts';
import { buildHandover, daysSinceHandover } from './lib/generate.ts';
import { isoTime, type Handover, type Intake, type Phase, type PromiseStatus } from './lib/types.ts';

const KV_INTAKE = 'intake';
const KV_HANDOVER = 'handover';
const KV_PHASE = 'phase';
const KV_STATE = 'state';

/** 代行期間の一日を、実時間で何ミリ秒で流すか。見ている人を待たせないため。 */
export const MS_PER_PROXY_DAY = 420;

export type Answer = { choice: number; correct: boolean };

export type AfterState = {
  answers: Record<string, Answer>;
  /** 親密度の増減。引継書の値には触らず、差分だけを持つ。 */
  deltas: Record<string, number>;
  pledges: Record<string, PromiseStatus>;
  /** その後の時間の倍率。1 なら実時間で、1 日の期限は本当に 1 日。 */
  rate: number;
};

/**
 * 既定は 1 日 = 1 時間。
 *
 * 1 日 = 1 分にしていたら、触っているあいだに本人の期間が代行期間を追い越して、
 * 図が「あなたが築いた」ように見えてしまった。既定は作品が正しく見える速さに置く。
 */
const EMPTY_AFTER: AfterState = { answers: {}, deltas: {}, pledges: {}, rate: 24 };

export type Store = {
  ready: boolean;
  persistent: boolean;
  phase: Phase;
  intake: Intake | null;
  handover: Handover | null;
  questions: Question[];
  messages: Message[];
  after: AfterState;
  /** 引き継ぎからの経過日数（倍率つき）。 */
  elapsed: number;
  /** あなたの区間の目安。いちばん遠い約束の期限。図の横幅の割り当てに使う。 */
  horizon: number;
  closenessOf: (companionId: string) => number;
  /** 引き継いだ時点の親密度。図の茶色の部分に使う。 */
  inheritedOf: (companionId: string) => number;

  apply: (input: Omit<Intake, 'startedAt'>) => Promise<void>;
  receive: () => Promise<void>;
  enter: () => Promise<void>;
  answer: (questionId: string, choice: number) => Promise<void>;
  setPledge: (pledgeId: string, status: PromiseStatus) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  reset: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の外で useStore を呼んだ');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [phase, setPhase] = useState<Phase>('intake');
  const [intake, setIntake] = useState<Intake | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [after, setAfter] = useState<AfterState>(EMPTY_AFTER);
  const [now, setNow] = useState(() => new Date());

  // 期限と連絡の到着を進めるための時計
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5_000);
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
      const [loadedIntake, loadedHandover, loadedPhase, loadedState] = await Promise.all([
        db.readKv<Intake>(KV_INTAKE),
        db.readKv<Handover>(KV_HANDOVER),
        db.readKv<Phase>(KV_PHASE),
        db.readKv<AfterState>(KV_STATE),
      ]);
      if (cancelled) return;
      setIntake(loadedIntake);
      setHandover(loadedHandover);
      if (loadedPhase) setPhase(loadedPhase);
      if (loadedState) setAfter({ ...EMPTY_AFTER, ...loadedState });
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

  const apply = useCallback(
    async (input: Omit<Intake, 'startedAt'>) => {
      const next: Intake = { ...input, startedAt: isoTime(new Date()) };
      /*
       * 引継書は申込の時点で組み立てて、そのまま保存する。
       *
       * 代行期間のあいだ本人には見せないが、**中身はもう決まっている**。
       * 「これから関係を築く」のではなく「もう築かれたものを渡される」という
       * 順序が、このサービスの本質なので、実装もその順序にしてある。
       */
      const built = buildHandover(next, new Date(), Math.random);
      setIntake(next);
      setHandover(built);
      setPhase('proxy');
      setAfter(EMPTY_AFTER);
      await save(KV_INTAKE, next);
      await save(KV_HANDOVER, built);
      await save(KV_PHASE, 'proxy');
      await save(KV_STATE, EMPTY_AFTER);
    },
    [save],
  );

  const receive = useCallback(async () => {
    setPhase('handover');
    await save(KV_PHASE, 'handover');
  }, [save]);

  const enter = useCallback(async () => {
    setPhase('after');
    await save(KV_PHASE, 'after');
  }, [save]);

  const questions = useMemo(() => (handover ? buildQuestions(handover, seeded(handover.serial)) : []), [handover]);
  const messages = useMemo(() => (handover ? buildMessages(handover, seeded(`${handover.serial}-m`)) : []), [handover]);

  const answer = useCallback(
    async (questionId: string, choice: number) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question || after.answers[questionId]) return;
      const correct = choice === question.answer;
      const next: AfterState = {
        ...after,
        answers: { ...after.answers, [questionId]: { choice, correct } },
        deltas: {
          ...after.deltas,
          [question.companionId]: (after.deltas[question.companionId] ?? 0) + (correct ? CLOSENESS_ON_RIGHT : CLOSENESS_ON_WRONG),
        },
      };
      setAfter(next);
      await save(KV_STATE, next);
    },
    [after, questions, save],
  );

  const setPledge = useCallback(
    async (pledgeId: string, status: PromiseStatus) => {
      const next: AfterState = { ...after, pledges: { ...after.pledges, [pledgeId]: status } };
      setAfter(next);
      await save(KV_STATE, next);
    },
    [after, save],
  );

  const setRate = useCallback(
    async (rate: number) => {
      const next: AfterState = { ...after, rate };
      setAfter(next);
      await save(KV_STATE, next);
    },
    [after, save],
  );

  const reset = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    setIntake(null);
    setHandover(null);
    setPhase('intake');
    setAfter(EMPTY_AFTER);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const elapsed = handover && phase === 'after' ? daysSinceHandover(handover, now, after.rate) : 0;
    return {
      ready,
      persistent,
      phase,
      intake,
      handover,
      questions,
      messages,
      after,
      elapsed,
      horizon: Math.max(14, ...(handover?.pledges.map((p) => p.dueDay) ?? [14])),
      closenessOf: (companionId) => {
        const base = handover?.companions.find((c) => c.id === companionId)?.closeness ?? 0;
        return effectiveCloseness(base, after.deltas[companionId] ?? 0, elapsed);
      },
      inheritedOf: (companionId) =>
        inheritedCloseness(handover?.companions.find((c) => c.id === companionId)?.closeness ?? 0),
      apply,
      receive,
      enter,
      answer,
      setPledge,
      setRate,
      reset,
    };
  }, [after, answer, apply, enter, handover, intake, messages, now, persistent, phase, questions, ready, receive, reset, setPledge, setRate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * 引継書の番号から作る乱数。
 *
 * 問いと連絡は保存していない（引継書から毎回組み立て直す）。同じ書類からは
 * 必ず同じ問いが出ないと、答えを覚えたあとに別の問いが出てしまう。
 */
function seeded(key: string): () => number {
  let state = 0;
  for (const ch of key) state = (state * 31 + (ch.codePointAt(0) ?? 0)) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
