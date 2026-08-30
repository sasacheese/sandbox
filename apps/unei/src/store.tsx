/**
 * 状態と、運営の駆動。
 *
 * 運営は「アプリを開いているあいだだけ動く」のではなく、**開いていない
 * あいだも動いていたことにする**。閉じている間の経過は時刻の差から復元され、
 * 開いた瞬間にまとめて起きる（指令が出ていた、取りこぼした、名前が変わっていた）。
 * ここを妥協して「開いたときから動く」にすると、運営が自分の付属品になる。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { draftDirective, draftUtterance, draftVerdict, DEFAULT_MODEL } from './lib/claude.ts';
import * as db from './lib/db.ts';
import { moodNow, shiftMood } from './lib/mood.ts';
import { makeDecree, makeDirective, makeVerdict, nextActions, OTHERS, type Action } from './lib/operator.ts';
import {
  isoTime,
  newId,
  MOOD_ON_ACCEPTED,
  MOOD_ON_MISSED,
  MOOD_ON_REJECTED,
  type Decree,
  type DecreeId,
  type Directive,
  type DirectiveId,
  type Me,
  type MemberId,
  type Realm,
} from './lib/types.ts';

const KV_ME = 'me';
const KV_REALM = 'realm';
const KV_SETTINGS = 'settings';
const KV_PLACES = 'places';

export type Settings = {
  /** 時間の倍率。1 が実時間。運営の間隔・機嫌の減り・集合までの猶予すべてに効く。 */
  rate: number;
  /** 本物のモデルに書かせるか。鍵が無ければ雛形で動く。 */
  useClaude: boolean;
  apiKey: string;
  model: string;
};

const DEFAULT_SETTINGS: Settings = { rate: 1, useClaude: false, apiKey: '', model: DEFAULT_MODEL };

const INITIAL_REALM: Omit<Realm, 'moodAt'> = {
  name: '第七区',
  laws: ['指令の理由を問わないこと', '報告は一度きりとし、訂正しないこと'],
  accent: '#c8452e',
  mood: 50,
  silenced: [],
  stopped: false,
};

export type Store = {
  ready: boolean;
  persistent: boolean;
  me: Me | null;
  realm: Realm;
  directives: Directive[];
  decrees: Decree[];
  places: string[];
  settings: Settings;
  mood: number;
  /** いま応答すべき指令。無ければ null。 */
  open: Directive | null;
  /** 運営が動いている最中（本物のモデルに書かせているあいだ）。 */
  thinking: boolean;

  enroll: (name: string, places: string[]) => Promise<void>;
  addPlace: (place: string) => Promise<void>;
  removePlace: (place: string) => Promise<void>;
  attend: (id: DirectiveId) => Promise<void>;
  report: (id: DirectiveId, input: { people: number; note: string; imageUrl?: string }) => Promise<void>;
  requestStop: () => Promise<void>;
  withdrawStop: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  wipe: () => Promise<void>;
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
  const [me, setMe] = useState<Me | null>(null);
  const [realm, setRealm] = useState<Realm>({ ...INITIAL_REALM, moodAt: isoTime(new Date()) });
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [decrees, setDecrees] = useState<Decree[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [thinking, setThinking] = useState(false);
  /*
   * 機嫌を出すためだけの時計。
   *
   * 機嫌は保存された値ではなく経過から計算するので、何かが起きるまで
   * 画面の数字が動かない。運営の駆動と同じ間隔で now を配って、
   * 誰も何もしていない時間にも機嫌が減っていくのを見えるようにする。
   */
  const [clock, setClock] = useState(() => new Date());

  // 続けて呼ばれる操作が、まだ描画に反映されていない値を見ないようにする
  const realmRef = useRef(realm);
  const directivesRef = useRef(directives);
  const decreesRef = useRef(decrees);
  const settingsRef = useRef(settings);
  const placesRef = useRef(places);
  useEffect(() => {
    realmRef.current = realm;
  }, [realm]);
  useEffect(() => {
    directivesRef.current = directives;
  }, [directives]);
  useEffect(() => {
    decreesRef.current = decrees;
  }, [decrees]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  const saveRealm = useCallback(
    async (next: Realm) => {
      realmRef.current = next;
      setRealm(next);
      if (persistent) await db.writeKv(KV_REALM, next).catch(() => undefined);
    },
    [persistent],
  );

  const saveDirective = useCallback(
    async (directive: Directive) => {
      const next = [...directivesRef.current.filter((d) => d.id !== directive.id), directive];
      directivesRef.current = next;
      setDirectives(next);
      if (persistent) await db.put(db.STORES.directives, directive).catch(() => undefined);
    },
    [persistent],
  );

  const saveDecree = useCallback(
    async (decree: Decree) => {
      const next = [...decreesRef.current, decree];
      decreesRef.current = next;
      setDecrees(next);
      if (persistent) await db.put(db.STORES.decrees, decree).catch(() => undefined);
    },
    [persistent],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await db.isPersistent();
      if (cancelled) return;
      setPersistent(ok);
      if (!ok) return;
      db.requestPersistence().catch(() => undefined);
      const [loadedMe, loadedRealm, loadedSettings, loadedPlaces, loadedDirectives, loadedDecrees] = await Promise.all([
        db.readKv<Me>(KV_ME),
        db.readKv<Realm>(KV_REALM),
        db.readKv<Settings>(KV_SETTINGS),
        db.readKv<string[]>(KV_PLACES),
        db.readDirectives(),
        db.readDecrees(),
      ]);
      if (cancelled) return;
      setMe(loadedMe);
      if (loadedRealm) setRealm(loadedRealm);
      if (loadedSettings) setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      if (loadedPlaces) setPlaces(loadedPlaces);
      setDirectives(loadedDirectives);
      setDecrees(loadedDecrees);
    })()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 指令を出す。本物のモデルが失敗したら黙って雛形へ落ちる。 */
  const issue = useCallback(
    async (now: Date) => {
      const config = settingsRef.current;
      const registered = placesRef.current;
      const recent = directivesRef.current.slice(-4).map((d) => d.condition);
      let draft = null as { place: string; minPeople: number; condition: string; gatherOffsetMinutes: number } | null;
      if (config.useClaude && config.apiKey) {
        setThinking(true);
        draft = await draftDirective(config.apiKey, config.model, {
          places: registered.length > 0 ? registered : ['前回と同じ場所'],
          mood: moodNow(realmRef.current, now, config.rate),
          recentConditions: recent,
        });
        setThinking(false);
      }
      const fallback = makeDirective(registered);
      const chosen = draft ?? fallback;
      // 倍率をかけると集合までの猶予も縮む。展示で待たされないため
      const gatherAt = new Date(now.getTime() + (chosen.gatherOffsetMinutes * 60_000) / config.rate);
      const others = OTHERS.filter((n) => !realmRef.current.silenced.includes(n));
      const attendees = others.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 4));
      await saveDirective({
        id: newId<'DirectiveId'>() as DirectiveId,
        issuedAt: isoTime(now),
        gatherAt: isoTime(gatherAt),
        place: chosen.place,
        minPeople: chosen.minPeople,
        condition: chosen.condition,
        status: 'open',
        attending: false,
        attendees,
      });
    },
    [saveDirective],
  );

  /** 布告。権限の行使そのもの（名前・掟・色・沈黙）はここで Realm に適用する。 */
  const decree = useCallback(
    async (now: Date) => {
      const config = settingsRef.current;
      const current = realmRef.current;
      const draft = makeDecree(current);
      let text = draft.text;
      if (draft.kind === 'utterance' && config.useClaude && config.apiKey) {
        setThinking(true);
        const written = await draftUtterance(config.apiKey, config.model, {
          realmName: current.name,
          mood: moodNow(current, now, config.rate),
          since: lastFestivalLabel(directivesRef.current, now),
        });
        setThinking(false);
        if (written) text = written.text;
      }
      let next = current;
      if (draft.kind === 'rename') next = { ...next, name: draft.value };
      if (draft.kind === 'law_add') next = { ...next, laws: [...next.laws, draft.value] };
      if (draft.kind === 'law_remove') next = { ...next, laws: next.laws.filter((l) => l !== draft.value) };
      if (draft.kind === 'accent') next = { ...next, accent: draft.value };
      if (draft.kind === 'silence') next = { ...next, silenced: [...next.silenced, draft.value] };
      if (next !== current) await saveRealm(next);
      await saveDecree({ id: newId<'DecreeId'>() as DecreeId, at: isoTime(now), kind: draft.kind, text });
    },
    [saveDecree, saveRealm],
  );

  const apply = useCallback(
    async (actions: readonly Action[], now: Date) => {
      for (const action of actions) {
        if (action.kind === 'issue') await issue(now);
        if (action.kind === 'decree') await decree(now);
        if (action.kind === 'stop') await saveRealm({ ...realmRef.current, stopped: true });
        if (action.kind === 'miss') {
          const target = directivesRef.current.find((d) => d.id === action.id);
          if (!target) continue;
          await saveDirective({ ...target, status: 'missed' });
          await saveRealm(shiftMood(realmRef.current, MOOD_ON_MISSED, now, settingsRef.current.rate));
        }
      }
    },
    [decree, issue, saveDirective, saveRealm],
  );

  /*
   * 運営を回す。
   *
   * 二重に走らせない（本物のモデルへの問い合わせが遅いあいだに次の tick が
   * 来ると、指令が二つ出る）。ref の錠だけで足りる。
   */
  const running = useRef(false);
  const tick = useCallback(async () => {
    if (!ready || !me || running.current) return;
    running.current = true;
    try {
      const now = new Date();
      setClock(now);
      const lastDecreeAt = decreesRef.current.map((d) => d.at).sort().at(-1) ?? null;
      const actions = nextActions(
        { realm: realmRef.current, directives: directivesRef.current, lastDecreeAt },
        now,
        settingsRef.current.rate,
      );
      if (actions.length > 0) await apply(actions, now);
    } finally {
      running.current = false;
    }
  }, [apply, me, ready]);

  useEffect(() => {
    if (!ready || !me) return;
    void tick();
    const timer = setInterval(() => void tick(), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [me, ready, tick]);

  const enroll = useCallback(
    async (name: string, initialPlaces: string[]) => {
      const now = new Date();
      const next: Me = { id: newId<'MemberId'>() as MemberId, name: name.trim(), joinedAt: isoTime(now) };
      const cleaned = initialPlaces.map((p) => p.trim()).filter(Boolean);
      setMe(next);
      placesRef.current = cleaned;
      setPlaces(cleaned);
      const startRealm: Realm = { ...INITIAL_REALM, moodAt: isoTime(now) };
      await saveRealm(startRealm);
      if (persistent) {
        await db.writeKv(KV_ME, next).catch(() => undefined);
        await db.writeKv(KV_PLACES, cleaned).catch(() => undefined);
      }
    },
    [persistent, saveRealm],
  );

  const savePlaces = useCallback(
    async (next: string[]) => {
      placesRef.current = next;
      setPlaces(next);
      if (persistent) await db.writeKv(KV_PLACES, next).catch(() => undefined);
    },
    [persistent],
  );

  const attend = useCallback(
    async (id: DirectiveId) => {
      const target = directivesRef.current.find((d) => d.id === id);
      if (!target || target.status !== 'open') return;
      await saveDirective({ ...target, attending: true });
    },
    [saveDirective],
  );

  /** 報告 → 裁定 → 機嫌の増減。ここが一回りで、コミュニティの心拍にあたる。 */
  const report = useCallback(
    async (id: DirectiveId, input: { people: number; note: string; imageUrl?: string }) => {
      const target = directivesRef.current.find((d) => d.id === id);
      if (!target || (target.status !== 'open' && target.status !== 'missed')) return;
      const now = new Date();
      const config = settingsRef.current;
      const reported: Directive = {
        ...target,
        status: 'reported',
        report: {
          at: isoTime(now),
          people: input.people,
          note: input.note.trim(),
          ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
        },
      };
      await saveDirective(reported);

      let verdict: { accepted: boolean; text: string } | null = null;
      if (config.useClaude && config.apiKey) {
        setThinking(true);
        verdict = await draftVerdict(config.apiKey, config.model, {
          condition: target.condition,
          minPeople: target.minPeople,
          people: input.people,
          note: input.note,
          mood: moodNow(realmRef.current, now, config.rate),
        });
        setThinking(false);
      }
      const decided = verdict ?? makeVerdict(input.people, target.minPeople, Math.random, Boolean(input.imageUrl));
      await saveDirective({
        ...reported,
        status: decided.accepted ? 'accepted' : 'rejected',
        verdict: { at: isoTime(new Date()), accepted: decided.accepted, text: decided.text },
      });
      await saveRealm(
        shiftMood(realmRef.current, decided.accepted ? MOOD_ON_ACCEPTED : MOOD_ON_REJECTED, new Date(), config.rate),
      );
    },
    [saveDirective, saveRealm],
  );

  const requestStop = useCallback(async () => {
    if (realmRef.current.stopRequestedAt || realmRef.current.stopped) return;
    await saveRealm({ ...realmRef.current, stopRequestedAt: isoTime(new Date()) });
  }, [saveRealm]);

  const withdrawStop = useCallback(async () => {
    const next = { ...realmRef.current };
    delete next.stopRequestedAt;
    await saveRealm(next);
  }, [saveRealm]);

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const previous = settingsRef.current;
      const next = { ...previous, ...patch };
      settingsRef.current = next;
      setSettings(next);
      if (persistent) await db.writeKv(KV_SETTINGS, next).catch(() => undefined);

      /*
       * 倍率を変えたら、まだ来ていない集合時刻も縮める（伸ばす）。
       *
       * 集合時刻は実時刻として保存されているので、倍率だけ変えても
       * 「あと 59 分」は 59 分のまま残る。展示で早送りにした人が、
       * 一時間待たされることになるのを避ける。過ぎた時刻には触らない。
       */
      if (patch.rate !== undefined && patch.rate !== previous.rate) {
        const now = new Date();
        for (const directive of directivesRef.current) {
          if (directive.status !== 'open') continue;
          const remaining = new Date(directive.gatherAt).getTime() - now.getTime();
          if (remaining <= 0) continue;
          const scaled = (remaining * previous.rate) / patch.rate;
          await saveDirective({ ...directive, gatherAt: isoTime(new Date(now.getTime() + scaled)) });
        }
      }
    },
    [persistent, saveDirective],
  );

  const wipeAll = useCallback(async () => {
    if (persistent) await db.wipe().catch(() => undefined);
    const fresh: Realm = { ...INITIAL_REALM, moodAt: isoTime(new Date()) };
    realmRef.current = fresh;
    directivesRef.current = [];
    decreesRef.current = [];
    placesRef.current = [];
    setMe(null);
    setRealm(fresh);
    setDirectives([]);
    setDecrees([]);
    setPlaces([]);
    setSettings(DEFAULT_SETTINGS);
  }, [persistent]);

  const value = useMemo<Store>(() => {
    const open = [...directives].filter((d) => d.status === 'open').sort((a, b) => (a.gatherAt < b.gatherAt ? -1 : 1))[0] ?? null;
    return {
      ready,
      persistent,
      me,
      realm,
      directives,
      decrees,
      places,
      settings,
      mood: moodNow(realm, clock, settings.rate),
      open,
      thinking,
      enroll,
      addPlace: (place) => savePlaces([...places, place.trim()].filter(Boolean)),
      removePlace: (place) => savePlaces(places.filter((p) => p !== place)),
      attend,
      report,
      requestStop,
      withdrawStop,
      saveSettings,
      wipe: wipeAll,
    };
  }, [
    attend,
    clock,
    decrees,
    directives,
    enroll,
    me,
    persistent,
    places,
    realm,
    ready,
    report,
    requestStop,
    savePlaces,
    saveSettings,
    settings,
    thinking,
    wipeAll,
    withdrawStop,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function lastFestivalLabel(directives: readonly Directive[], now: Date): string {
  const last = directives.filter((d) => d.status === 'accepted').map((d) => d.verdict?.at ?? d.gatherAt).sort().at(-1);
  if (!last) return 'まだ一度も無い';
  const hours = Math.floor((now.getTime() - new Date(last).getTime()) / 3_600_000);
  return hours < 1 ? '一時間以内' : `${hours} 時間`;
}
