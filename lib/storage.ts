import { DEFAULT_SETTINGS, type ExamCheckpoint, type HistoryRecord, type UserSettings } from "./types";

const SETTINGS_KEY = "vocalis.settings.v1";
const HISTORY_KEY = "vocalis.history.v1";
const CHECKPOINT_KEY = "vocalis.checkpoint.v1";
const RECENT_TOPICS_KEY = "vocalis.recent-topics.v1";
const DB_NAME = "vocalis-audio-v1";
const STORE_NAME = "recordings";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<UserSettings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(settings: UserSettings) {
  writeJson(SETTINGS_KEY, settings);
}

export function loadHistory(): HistoryRecord[] {
  return readJson<HistoryRecord[]>(HISTORY_KEY, []);
}

export function saveHistory(records: HistoryRecord[]) {
  writeJson(HISTORY_KEY, records);
}

export function loadCheckpoint(): ExamCheckpoint | null {
  return readJson<ExamCheckpoint | null>(CHECKPOINT_KEY, null);
}

export function saveCheckpoint(checkpoint: ExamCheckpoint) {
  writeJson(CHECKPOINT_KEY, checkpoint);
}

export function clearCheckpoint() {
  if (typeof window !== "undefined") window.localStorage.removeItem(CHECKPOINT_KEY);
}

export function loadRecentTopicIds(): string[] {
  return readJson<string[]>(RECENT_TOPICS_KEY, []);
}

export function saveRecentTopicIds(ids: string[]) {
  writeJson(RECENT_TOPICS_KEY, [...new Set(ids)].slice(0, 12));
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open audio database"));
  });
}

export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save recording"));
  });
  db.close();
}

export async function loadAudioBlob(id: string): Promise<Blob | null> {
  const db = await openAudioDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Unable to load recording"));
  });
  db.close();
  return result;
}

export async function deleteAudioBlob(id: string): Promise<void> {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete recording"));
  });
  db.close();
}

export async function deleteRecordAudio(record: HistoryRecord): Promise<void> {
  await Promise.all(record.segments.map((segment) => deleteAudioBlob(segment.id).catch(() => undefined)));
}
