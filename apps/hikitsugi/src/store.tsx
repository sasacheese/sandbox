/**
 * 状態。
 *
 * 申込 → 交流 → 引継書 → 判断 → その後（または代理人へ継続）。
 *
 * 判断のところだけ分岐があり、それ以外は一本道。**引き継がない道も、
 * 引き継いだあとに代理人へ戻す道も用意してある**のが、この作品の要点。
 * どの道を選んでも失うものがあるので、「正解の分岐」は無い。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CLOSENESS_ON_AGENT_REPLY,
  CLOSENESS_ON_RIGHT,
  CLOSENESS_ON_SELF_REPLY,
  CLOSENESS_ON_WRONG,
  messages as buildMessages,
  questions as buildQuestions,
  type Question,
} from './lib/after.ts';
import { effectiveCloseness } from './lib/closeness.ts';
import * as db from './lib/db.ts';
import { buildHandover, daysSinceHandover } from './lib/generate.ts';
import { EXTENSION_LINES } from './lib/pools.ts';
import { isoTime, type Decision, type Handover, type Intake, type Message, type Phase, type Pledge } from './lib/types.ts';

type PledgeStatus = Pledge['status'];

const KV_INTAKE = 'intake';
const KV_HANDOVER = 'handover';
const KV_PHASE = 'phase';
const KV_STATE = 'state';

/** 交流期間の一日を、実時間で何ミリ秒で流すか。 */
export const MS_PER_PROXY_DAY = 380;

/** 延長は一回 14 日。 */
export const EXTENSION_DAYS = 14;

export type Answer = { choice: number; correct: boolean };
export type ReplyKind = 'self' | 'agent';

export type AfterState = {
  decision: Decision | null;
  answers: Record<string, Answer>;
  replies: Record<string, ReplyKind>;
  /** 親密度の増減。相手は一人なので数値ひとつ。 */
  delta: number;
  pledges: Record<string, PledgeStatus>;
  /** その後の時間の倍率。既定は 1 日 = 1 時間。 */
  rate: number;
  extended: number;
};

const EMPTY_AFTER: AfterState = { decision: null, answers: {}, replies: {}, delta: 0, pledges: {}, rate: 24, extended: 0 };

export type Store = {
  ready: boolean;
  persistent: boolean;
  phase: Phase;
  intake: Intake | null;
  handover: Handover | null;
  questions: Question[];
  messages: Message[];
  after: AfterState;
  elapsed: number;
  horizon: number;
  /**
   * 相手の氏名を出してよいか。
   *
   * **双方が引き継いだ場合だけ**開示される。こちらが引き継いでも、相手が
   * 代理人に任せた（または拒否した）場合は最後まで「A」のまま。
   * 申込書の条項にそう書いてあるので、実装がそれを破ってはいけない。
   */
  revealed: boolean;
  closeness: number;
  inherited: number;
  /** 代理人に任せた返信の数。 */
  agentReplies: number;

  apply: (input: Omit<Intake, 'startedAt'>) => Promise<void>;
  receive: () => Promise<void>;
  decide: (decision: Decision) => Promise<void>;
  enter: () => Promise<void>;
  answer: (questionId: string, choice: number) => Promise<void>;
  reply: (messageId: string, kind: ReplyKind) => Promise<void>;
  setPledge: (pledgeId: string, status: PledgeStatus) => Promise<void>;
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
  const [clock, setClock] = useState(() => new Date());

  const afterRef = useRef(after);
  useEffect(() => {
    afterRef.current = after;
  }, [after]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 5_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setClock(new Date());
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

  const saveAfter = useCallback(
    async (next: AfterState) => {
      afterRef.current = next;
      setAfter(next);
      await save(KV_STATE, next);
    },
    [save],
  );

  const apply = useCallback(
    async (input: Omit<Intake, 'startedAt'>) => {
      const next: Intake = { ...input, startedAt: isoTime(new Date()) };
      /*
       * 引継書は申込の時点で組み立てて保存する。
       *
       * 交流期間のあいだ本人には見せないが、**中身はもう決まっている**。
       * 相手側の人間の判断まで、この瞬間に確定している。
       */
      const built = buildHandover(next, new Date(), Math.random);
      setIntake(next);
      setHandover(built);
      setPhase('proxy');
      await saveAfter(EMPTY_AFTER);
      await save(KV_INTAKE, next);
      await save(KV_HANDOVER, built);
      await save(KV_PHASE, 'proxy');
    },
    [save, saveAfter],
  );

  const receive = useCallback(async () => {
    setPhase('handover');
    await save(KV_PHASE, 'handover');
  }, [save]);

  /**
   * 本人の判断。
   *
   * 「もう少し続けさせる」だけは分岐が特別で、交流期間へ戻る。延ばせば
   * 親密度は上がり、やり取りも増える。**延ばすほど引き継ぎにくくなる**。
   */
  const decide = useCallback(
    async (decision: Decision) => {
      if (!intake || !handover) return;
      if (decision === 'extend') {
        const days = intake.days + EXTENSION_DAYS;
        const nextIntake: Intake = { ...intake, days, startedAt: isoTime(new Date()) };
        const extra = EXTENSION_LINES.map((line) => ({ ...line, day: days }));
        const nextHandover: Handover = {
          ...handover,
          days,
          counterpart: { ...handover.counterpart, closeness: Math.min(95, handover.counterpart.closeness + 4) },
          exchanges: [...handover.exchanges, ...extra],
        };
        setIntake(nextIntake);
        setHandover(nextHandover);
        setPhase('proxy');
        await saveAfter({ ...afterRef.current, extended: afterRef.current.extended + 1 });
        await save(KV_INTAKE, nextIntake);
        await save(KV_HANDOVER, nextHandover);
        await save(KV_PHASE, 'proxy');
        return;
      }
      await saveAfter({ ...afterRef.current, decision });
      setPhase('result');
      await save(KV_PHASE, 'result');
    },
    [handover, intake, save, saveAfter],
  );

  /** 結果を読んだあと、その後の画面へ進む。 */
  const enter = useCallback(async () => {
    const decision = afterRef.current.decision;
    const next: Phase = decision === 'inherit' && handover?.theirs !== 'refuse' ? 'after' : 'released';
    setPhase(next);
    await save(KV_PHASE, next);
  }, [handover?.theirs, save]);

  const questions = useMemo(() => (handover ? buildQuestions(handover, seeded(handover.serial)) : []), [handover]);
  const messages = useMemo(
    () => (handover && after.decision ? buildMessages(handover, after.decision) : []),
    [after.decision, handover],
  );

  const answer = useCallback(
    async (questionId: string, choice: number) => {
      const question = questions.find((q) => q.id === questionId);
      const state = afterRef.current;
      if (!question || state.answers[questionId]) return;
      const correct = choice === question.answer;
      await saveAfter({
        ...state,
        answers: { ...state.answers, [questionId]: { choice, correct } },
        delta: state.delta + (correct ? CLOSENESS_ON_RIGHT : CLOSENESS_ON_WRONG),
      });
    },
    [questions, saveAfter],
  );

  /**
   * 返し方を選ぶ。
   *
   * 自分の言葉で返すと下がり、代理人に任せると下がらない。**下がらない方を
   * 選び続けると、自分は一度もこの関係に参加しないまま維持される。**
   */
  const reply = useCallback(
    async (messageId: string, kind: ReplyKind) => {
      const state = afterRef.current;
      if (state.replies[messageId]) return;
      await saveAfter({
        ...state,
        replies: { ...state.replies, [messageId]: kind },
        delta: state.delta + (kind === 'self' ? CLOSENESS_ON_SELF_REPLY : CLOSENESS_ON_AGENT_REPLY),
      });
    },
    [saveAfter],
  );

  const setPledge = useCallback(
    async (pledgeId: string, status: PledgeStatus) => {
      const state = afterRef.current;
      await saveAfter({ ...state, pledges: { ...state.pledges, [pledgeId]: status } });
    },
    [saveAfter],
  );

  const setRate = useCallback(
    async (rate: number) => {
      await saveAfter({ ...afterRef.current, rate });
    },
    [saveAfter],
  );

  const reset = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    setIntake(null);
    setHandover(null);
    setPhase('intake');
    afterRef.current = EMPTY_AFTER;
    setAfter(EMPTY_AFTER);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const counting = phase === 'after' || phase === 'released';
    const elapsed = handover && counting ? daysSinceHandover(handover, clock, after.rate) : 0;
    const inherited = handover?.counterpart.closeness ?? 0;
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
      revealed: after.decision === 'inherit' && handover?.theirs === 'inherit',
      inherited,
      closeness: effectiveCloseness(inherited, after.delta, elapsed),
      agentReplies: Object.values(after.replies).filter((kind) => kind === 'agent').length,
      apply,
      receive,
      decide,
      enter,
      answer,
      reply,
      setPledge,
      setRate,
      reset,
    };
  }, [after, answer, apply, clock, decide, enter, handover, intake, messages, persistent, phase, questions, ready, receive, reply, reset, setPledge, setRate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** 引継書の番号から作る乱数。同じ書類からは必ず同じ問いが出る。 */
function seeded(key: string): () => number {
  let state = 0;
  for (const ch of key) state = (state * 31 + (ch.codePointAt(0) ?? 0)) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
