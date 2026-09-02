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
import { interpret, openingOf, replyFor, type Rule } from './lib/agent.ts';
import { buildHandover, buildPlainThreads, buildThreads, mannerOf, withState, type Holds, type Jumps } from './lib/generate.ts';
import { slipsOf } from './lib/slips.ts';
import { DEFAULT_MODEL, generateSeed, hydrateSeed, type Api, type StoredSeed } from './lib/generate-seed.ts';
import { COUNTERPARTS, type CounterpartSeed } from './lib/pools.ts';
import { ownNameOf, parseAll, toneOf, type Message, type Transcript } from './lib/transcript.ts';
import { dropFor } from './lib/closeness.ts';
import { draftFor as draftOf } from './lib/draft.ts';
import { DEFAULT_LOOP_MS, loopAt } from './lib/loop.ts';
import { agentReplyText, bubblesOf, isReady } from './lib/threads.ts';
import {
  isoTime,
  type AskAnswer,
  type Decision,
  type Handover,
  type Intake,
  type IsoTime,
  type Slip,
  type Thread,
  type ThreadState,
} from './lib/types.ts';

const KV_INTAKE = 'intake';
const KV_TRANSCRIPTS = 'transcripts';
const KV_SETTINGS = 'settings';
const KV_PROGRESS = 'progress';
const KV_SEEDS = 'seeds';
const KV_RULES = 'rules';
const KV_AGENT = 'agent';

/**
 * モデルの鍵と名前。ビルド時に GitHub の secret / variable から束ねる。
 *
 * **配信物に入るので、公開サイトから読める。**上限つきの鍵を使うこと。
 * 設定画面には出さない（本人の判断）。手元の dev では空で、生成は使えない。
 */
const API: Api = {
  key: import.meta.env.VITE_OPENAI_API_KEY ?? '',
  model: import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL,
};

export type Settings = {
  /** 一巡の長さ。 */
  loopMs: number;
  /** 一巡目が始まった時刻。ここからの経過で何巡目のどこにいるかが決まる。 */
  startedAt: IsoTime;
};

/**
 * 本人が触った跡。一巡が終わると空になる。
 *
 * `jumps` は治具——引き継いだ状態から始めた相手と、その時刻。進行と一緒に流す。
 */
export type Progress = { loop: number; states: Record<string, ThreadState>; jumps?: Jumps };

const EMPTY_PROGRESS: Progress = { loop: 0, states: {} };
const EMPTY_STATE: ThreadState = { sent: [], answers: {}, delta: 0 };

export type Store = {
  ready: boolean;
  persistent: boolean;
  /** 取り込んだ過去ログ。**これが無いと何も始まらない。** */
  transcripts: Transcript[];
  /** 履歴の中の自分の表示名。取り込んだ時点で分かる。 */
  own: string | null;
  /** 代理応答（ラボ）を使っているか。申込が入っているかどうかと同じ。 */
  lab: boolean;
  intake: Intake | null;
  threads: Thread[];
  settings: Settings;
  /** 画面を動かすための時計。 */
  now: Date;
  /** いま何巡目のどこにいるか。 */
  loop: { index: number; phase: number; total: number };

  /** 台本の一覧。手書きの九人＋取り込んだ履歴から作ったもの。 */
  seeds: CounterpartSeed[];
  /** 止めている相手。 */
  holds: Holds;
  /** 代理への指示。一周が終わっても残る。 */
  rules: Rule[];
  /** モデルの鍵と名前。ビルド時に束ねたもの。空なら生成は使えない。 */
  api: Api;
  /** 台本を作っている最中／失敗した相手。 */
  generating: Record<string, 'busy' | 'error'>;

  /** 自分のトーク（代理とのトーク＋止まっているもの＋引き継いだもの）。 */
  mine: Thread[];
  /** 代理人のトーク（まだ引き継いでいないもの）。 */
  proxies: Thread[];

  handoverFor: (threadId: string) => Handover | null;
  readyCount: number;

  /** トーク履歴を取り込む。読めなかったものは黙って落とす。 */
  importTexts: (texts: readonly string[]) => Promise<number>;
  /** 履歴を足す。同じ相手のものは差し替える。 */
  appendTexts: (texts: readonly string[]) => Promise<number>;
  /** 代理へ言う。止める・再開する・申し送る。 */
  tellAgent: (text: string) => Promise<void>;
  /** 取り込んだ相手の代理のやり取りを、履歴から作る。鍵が要る。 */
  generateFor: (name: string) => Promise<void>;
  /** 代理応答をオンにする。ここから一周が始まる。 */
  enableLab: (persona: number) => Promise<void>;
  /** 代理応答をオフにする。動いていた交流は残らない。 */
  disableLab: () => Promise<void>;
  /**
   * 送る。`draft` は代理の下書きをそのまま送ったとき（近さは下がらない）。
   * 自分で打ったときは、引継書の作法から外れたぶんを数えて、そのぶん下がる。
   */
  send: (threadId: string, text: string, options?: { draft?: boolean }) => Promise<void>;
  /** いま入力欄の上に出す、代理の下書き。引き継いだトーク以外は null。 */
  draftFor: (threadId: string) => string | null;
  delegate: (threadId: string) => Promise<void>;
  markRead: (threadId: string) => Promise<void>;
  /** 「相手は本人ですか？」と訊く。「はい、本人です」と返る。**検証はできない。** */
  checkHuman: (threadId: string) => Promise<void>;
  /** 代理人からの確認に答える。答えないと代理人が埋める。 */
  answerAsk: (threadId: string, askId: string, answer: AskAnswer) => Promise<void>;
  decide: (threadId: string, decision: Decision) => Promise<void>;
  /**
   * 治具。その相手を、引き継いだ状態から始める。
   *
   * 引き継いだ後を一回試すのに一周待たなくてよいようにするためのもの。
   * 相手側の判断は決めない。
   */
  startInherited: (seedId: string) => Promise<void>;
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
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [stored, setStored] = useState<StoredSeed[]>([]);
  const [rulebook, setRulebook] = useState<{ rules: Rule[]; holds: Holds }>({ rules: [], holds: {} });
  const [agentLog, setAgentLog] = useState<Message[]>([]);
  const [generating, setGenerating] = useState<Record<string, 'busy' | 'error'>>({});
  const rulebookRef = useRef(rulebook);
  useEffect(() => {
    rulebookRef.current = rulebook;
  }, [rulebook]);
  const agentLogRef = useRef(agentLog);
  useEffect(() => {
    agentLogRef.current = agentLog;
  }, [agentLog]);
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
      const [loadedIntake, loadedSettings, loadedProgress, loadedTranscripts, loadedSeeds, loadedRules, loadedAgent] = await Promise.all([
        db.readKv<Intake>(KV_INTAKE),
        db.readKv<Partial<Settings>>(KV_SETTINGS),
        db.readKv<Progress>(KV_PROGRESS),
        db.readKv<Transcript[]>(KV_TRANSCRIPTS),
        db.readKv<StoredSeed[]>(KV_SEEDS),
        db.readKv<{ rules: Rule[]; holds: Holds }>(KV_RULES),
        db.readKv<Message[]>(KV_AGENT),
      ]);
      if (cancelled) return;
      if (loadedTranscripts) setTranscripts(loadedTranscripts);
      if (loadedSeeds) setStored(loadedSeeds);
      if (loadedRules) setRulebook(loadedRules);
      // 代理応答をオンにしたまま、代理とのトークが空のことがある（前の版から続けた場合）。
      // 最初の一通だけ入れておく。指示を書く場所がここだと分からないと、使えない
      const own = loadedTranscripts ? ownNameOf(loadedTranscripts) : null;
      const opening: Message[] =
        loadedAgent && loadedAgent.length > 0
          ? loadedAgent
          : loadedIntake && loadedTranscripts && loadedTranscripts.length > 0
            ? [{ at: Date.now(), mine: false, text: openingOf(own ?? 'あなた', loadedTranscripts.length) }]
            : [];
      setAgentLog(opening);
      agentLogRef.current = opening;
      // 履歴が無いのに代理応答だけオンになっている状態は作らない。
      // 代理は過去ログのある相手にしか出せないので、そこだけ残っても意味がない
      setIntake(loadedTranscripts && loadedTranscripts.length > 0 ? loadedIntake : null);
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

  /** 手書きの九人に、取り込んだ履歴から作ったものを足す。 */
  const seeds = useMemo<CounterpartSeed[]>(() => [...COUNTERPARTS, ...stored.map(hydrateSeed)], [stored]);

  const threads = useMemo(() => {
    if (transcripts.length === 0) return [];
    // 代理応答がオフのあいだは、自分のトークだけが並ぶ普通のメッセンジャー
    const built = intake
      ? buildThreads(now, transcripts, startedAt, settings.loopMs, seeds, rulebook.holds, agentLog, progress.jumps ?? {})
      : buildPlainThreads(transcripts, startedAt);
    return built.map((thread) => withState(thread, progress.states[thread.id]));
  }, [agentLog, intake, now, progress.jumps, progress.states, rulebook.holds, seeds, settings.loopMs, startedAt, transcripts]);

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

  const importTexts = useCallback(
    async (texts: readonly string[]) => {
      const parsed = parseAll(texts);
      if (parsed.length === 0) return 0;
      setTranscripts(parsed);
      await save(KV_TRANSCRIPTS, parsed);
      return parsed.length;
    },
    [save],
  );

  const enableLab = useCallback(
    async (persona: number) => {
      const at = new Date();
      /*
       * 代理のトークは、オンにした時点で**すでに進んでいる**。
       *
       * 一本は終わっていて、二本は途中。これから始まるのではなく、もう進んで
       * いたものを見せられる、という順序をここで作っている。残りは眺めている
       * あいだに増える。
       */
      const own = ownNameOf(transcripts) ?? 'あなた';
      const nextIntake: Intake = { name: own, persona, startedAt: isoTime(at) };
      const nextSettings = freshSettings(at);
      setIntake(nextIntake);
      setSettings(nextSettings);
      progressRef.current = EMPTY_PROGRESS;
      setProgress(EMPTY_PROGRESS);
      // 代理から最初の一通。指示を書く場所がここだと、最初に分かるように
      const opening: Message[] = agentLogRef.current.length > 0 ? agentLogRef.current : [{ at: at.getTime(), mine: false, text: openingOf(own, transcripts.length) }];
      agentLogRef.current = opening;
      setAgentLog(opening);
      await save(KV_INTAKE, nextIntake);
      await save(KV_SETTINGS, nextSettings);
      await save(KV_PROGRESS, EMPTY_PROGRESS);
      await save(KV_AGENT, opening);
    },
    [save, transcripts],
  );

  const appendTexts = useCallback(
    async (texts: readonly string[]) => {
      const parsed = parseAll(texts);
      if (parsed.length === 0) return 0;
      // 同じ相手のものは差し替える。名前が鍵
      const names = new Set(parsed.map((t) => t.name));
      const next = [...transcripts.filter((t) => !names.has(t.name)), ...parsed];
      setTranscripts(next);
      await save(KV_TRANSCRIPTS, next);
      return parsed.length;
    },
    [save, transcripts],
  );

  /**
   * 代理へ言う。
   *
   * 名前と動詞が読めれば止める・再開する。読めなければ申し送りとして引き取り、
   * 引継書の注意事項に載せる。返事は少し置いてから届く——即答すると、読んで
   * いないように見える。
   */
  const tellAgent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const at = new Date();
      const names = transcripts.map((t) => t.name);
      const read = interpret(trimmed, names);
      const rule: Rule = { id: newId('rule'), at: isoTime(at), text: trimmed, kind: read.kind, ...(read.target ? { target: read.target } : {}) };

      const current = rulebookRef.current;
      const holds: Holds = { ...current.holds };
      if (rule.target && rule.kind === 'mute') {
        const hold = holds[rule.target] ?? { since: null, total: 0 };
        if (hold.since === null) holds[rule.target] = { ...hold, since: at.getTime() };
      }
      if (rule.target && rule.kind === 'unmute') {
        const hold = holds[rule.target];
        if (hold && hold.since !== null) holds[rule.target] = { since: null, total: hold.total + (at.getTime() - hold.since) };
      }
      const nextRulebook = { rules: [...current.rules, rule], holds };
      rulebookRef.current = nextRulebook;
      setRulebook(nextRulebook);

      const mine: Message = { at: at.getTime(), mine: true, text: trimmed };
      const withMine = [...agentLogRef.current, mine];
      agentLogRef.current = withMine;
      setAgentLog(withMine);
      await save(KV_RULES, nextRulebook);
      await save(KV_AGENT, withMine);

      const live = threadsRef.current.filter((t) => t.kind === 'proxy' && !t.decision).map((t) => t.title);
      const reply: Message = { at: at.getTime() + 1_400, mine: false, text: replyFor(rule, live) };
      await new Promise((resolve) => setTimeout(resolve, 1_400));
      const withReply = [...agentLogRef.current, reply];
      agentLogRef.current = withReply;
      setAgentLog(withReply);
      await save(KV_AGENT, withReply);
    },
    [save, transcripts],
  );

  /**
   * 取り込んだ相手の台本を作る。
   *
   * 作った瞬間の位置から現れるので、作ったらすぐ一通目が届き始める。
   * 失敗したら失敗と出す。**壊れた台本で始めるより、無いほうがいい。**
   */
  const generateFor = useCallback(
    async (name: string) => {
      const transcript = transcripts.find((t) => t.name === name);
      if (!transcript || !API.key || !intake) return;
      setGenerating((g) => ({ ...g, [name]: 'busy' }));
      try {
        const phase = loopAt(new Date(), new Date(settings.startedAt).getTime(), settings.loopMs).phase / settings.loopMs;
        const seed = await generateSeed(transcript, intake.name, intake.persona, API, phase);
        const next = [...stored.filter((s) => s.name !== name), seed];
        setStored(next);
        await save(KV_SEEDS, next);
        setGenerating((g) => {
          const { [name]: _done, ...rest } = g;
          return rest;
        });
      } catch (e) {
        console.warn('台本を作れなかった', e);
        setGenerating((g) => ({ ...g, [name]: 'error' }));
      }
    },
    [intake, save, settings.loopMs, settings.startedAt, stored, transcripts],
  );

  /** 代理応答をオフにする。動いていた交流も、答えた確認も残らない。 */
  const disableLab = useCallback(async () => {
    setIntake(null);
    progressRef.current = EMPTY_PROGRESS;
    setProgress(EMPTY_PROGRESS);
    agentLogRef.current = [];
    setAgentLog([]);
    await save(KV_INTAKE, null);
    await save(KV_PROGRESS, EMPTY_PROGRESS);
    await save(KV_AGENT, []);
  }, [save]);

  const send = useCallback(
    async (threadId: string, text: string, options: { draft?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const at = new Date();
      /*
       * 踏み外し。引継書の作法と照らす。
       *
       * 返信の速さは、相手から届いた最後の一通からの実時間。もう返してあれば
       * 数えない（続けて言うのは遅れではない）。
       */
      const thread = threadsRef.current.find((t) => t.id === threadId);
      let slips: Slip[] = [];
      if (!options.draft && thread?.decision === 'inherit' && thread.inheritedAt && intake) {
        const manner = mannerOf(thread, transcripts.find((t) => t.name === thread.title), intake);
        if (manner) {
          const since = thread.inheritedAt;
          const after = bubblesOf(thread, at).filter((b) => b.at >= since && !b.system);
          const lastLeft = [...after].reverse().find((b) => b.side === 'left');
          const replied = lastLeft ? after.some((b) => b.side === 'right' && b.at > lastLeft.at) : true;
          const waited = lastLeft && !replied ? (at.getTime() - new Date(lastLeft.at).getTime()) / 60_000 : null;
          slips = slipsOf(trimmed, manner, waited);
        }
      }
      await patch(threadId, (state) => {
        const inherited = state.decision === 'inherit';
        /*
         * 代理の下書きをそのまま送れば、近さは保たれる。
         *
         * 自分で打つと下がる。代理人のほうが返信が早く、相手の話を忘れず、
         * 言葉を選べる。**人間には勝てない条件で築かれた関係**を引き継いだ
         * 結果がこれ。踏み外した数だけ、さらに下がる。
         */
        if (options.draft) {
          return { ...state, sent: [...state.sent, { id: newId('me'), at: isoTime(at), text: trimmed, byAgent: false, draft: true }] };
        }
        return {
          ...state,
          sent: [...state.sent, { id: newId('me'), at: isoTime(at), text: trimmed, byAgent: false, ...(slips.length > 0 ? { slips } : {}) }],
          delta: inherited ? state.delta - dropFor(slips.length) : state.delta,
        };
      });
    },
    [intake, patch, transcripts],
  );

  const draftFor = useCallback(
    (threadId: string): string | null => {
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (!thread) return null;
      const transcript = transcripts.find((t) => t.name === thread.title);
      return draftOf(thread, bubblesOf(thread, now), transcript ? toneOf(transcript) : null);
    },
    [now, transcripts],
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

  const checkHuman = useCallback(
    async (threadId: string) => {
      await patch(threadId, (state) => ({ ...state, checks: [...(state.checks ?? []), isoTime(new Date())] }));
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

  const startInherited = useCallback(
    async (seedId: string) => {
      const at = isoTime(new Date());
      const current = progressRef.current;
      const threadId = `proxy-${seedId}`;
      const next: Progress = {
        ...current,
        jumps: { ...(current.jumps ?? {}), [seedId]: at },
        states: {
          ...current.states,
          [threadId]: { ...(current.states[threadId] ?? EMPTY_STATE), decision: 'inherit', inheritedAt: at },
        },
      };
      progressRef.current = next;
      setProgress(next);
      await save(KV_PROGRESS, next);
    },
    [save],
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
    setTranscripts([]);
    setIntake(null);
    setSettings(freshSettings(new Date()));
    progressRef.current = EMPTY_PROGRESS;
    setProgress(EMPTY_PROGRESS);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const agent = threads.filter((t) => t.kind === 'agent');
    const mine = threads.filter((t) => t.kind === 'plain' || t.decision === 'inherit');
    const proxies = threads.filter((t) => t.kind === 'proxy' && t.decision !== 'inherit');
    // 新しいやり取りが上へ。届いた瞬間に一覧が動くので、放置していても賑やか。
    // 代理とのトークだけは、いつも一番上に留める
    const byActivity = (a: Thread, b: Thread) => lastAt(b, now).localeCompare(lastAt(a, now));
    return {
      ready,
      persistent,
      transcripts,
      own: ownNameOf(transcripts),
      lab: intake !== null,
      intake,
      threads,
      settings,
      now,
      loop: { index: position.index, phase: position.phase, total: settings.loopMs },
      seeds,
      holds: rulebook.holds,
      rules: rulebook.rules,
      api: API,
      generating,
      mine: [...agent, ...[...mine].sort(byActivity)],
      proxies: [...proxies].sort(byActivity),
      handoverFor: (threadId) => {
        const thread = threads.find((t) => t.id === threadId);
        return thread && intake ? buildHandover(thread, intake, transcripts, now, rulebook.rules) : null;
      },
      readyCount: proxies.filter((t) => isReady(t, now)).length,
      importTexts,
      appendTexts,
      tellAgent,
      generateFor,
      enableLab,
      disableLab,
      send,
      draftFor,
      delegate,
      markRead,
      checkHuman,
      answerAsk,
      decide,
      startInherited,
      setLoopMs,
      reset,
    };
  }, [
    agentLog,
    answerAsk,
    appendTexts,
    checkHuman,
    disableLab,
    enableLab,
    generateFor,
    generating,
    importTexts,
    rulebook,
    seeds,
    tellAgent,
    transcripts,
    decide,
    delegate,
    draftFor,
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
    startInherited,
    threads,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function lastAt(thread: Thread, now: Date): string {
  return bubblesOf(thread, now).at(-1)?.at ?? '';
}
