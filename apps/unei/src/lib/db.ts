/**
 * IndexedDB。指令・布告・コミュニティの状態の保存先。
 *
 * 運営が書き換えたもの（名前・掟・色・沈黙）は Realm 一つに集約して kv に置く。
 * 履歴として残す必要があるのは「いつ何を書き換えたか」＝布告の方なので、
 * 現在の姿と、そこへ至った経緯を別々に持っている。
 */

import type { Decree, Directive } from './types.ts';

const DB_NAME = 'unei';
const DB_VERSION = 1;

export const STORES = {
  kv: 'kv',
  directives: 'directives',
  decrees: 'decrees',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('この環境では IndexedDB が使えない'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB を開けない'));
    request.onblocked = () => reject(new Error('IndexedDB が別のタブで塞がれている'));
  });
  return opening;
}

export async function isPersistent(): Promise<boolean> {
  try {
    await open();
    return true;
  } catch {
    opening = null;
    return false;
  }
}

export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

async function tx<T>(name: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const request = run(transaction.objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`${name} の操作に失敗した`));
  });
}

export async function readAll<T>(name: StoreName): Promise<T[]> {
  return (await tx<T[]>(name, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)) ?? [];
}

export async function put(name: StoreName, value: { id: string }): Promise<void> {
  await tx(name, 'readwrite', (store) => store.put(value) as IDBRequest<IDBValidKey>);
}

export async function readDirectives(): Promise<Directive[]> {
  return readAll<Directive>(STORES.directives);
}

export async function readDecrees(): Promise<Decree[]> {
  return readAll<Decree>(STORES.decrees);
}

export async function readKv<T>(key: string): Promise<T | null> {
  const row = await tx<{ id: string; value: T } | undefined>(
    STORES.kv,
    'readonly',
    (store) => store.get(key) as IDBRequest<{ id: string; value: T } | undefined>,
  );
  return row ? row.value : null;
}

export async function writeKv<T>(key: string, value: T): Promise<void> {
  await put(STORES.kv, { id: key, value } as { id: string });
}

export async function wipe(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const names = Object.values(STORES);
    const transaction = db.transaction(names, 'readwrite');
    for (const name of names) transaction.objectStore(name).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('消去に失敗した'));
  });
}
