import {
  DEFAULT_SETTINGS,
  type Accent,
  type ExamCheckpoint,
  type HistoryRecord,
  type UserSettings,
} from "./types";
import { EXAMINER_VOICE_PRESETS } from "./core.mjs";
import type { ReportEnvelope } from "./reporting";
import type { ExpressionLibraryItem } from "./recommendations";

const SETTINGS_KEY = "vocalis.settings.v1";
const HISTORY_KEY = "vocalis.history.v1";
const CHECKPOINT_KEY = "vocalis.checkpoint.v1";
const RECENT_TOPICS_KEY = "vocalis.recent-topics.v1";
const RECENT_EXAMINERS_KEY = "vocalis.recent-examiners.v1";
const DB_NAME = "vocalis-audio-v1";
const STORE_NAME = "recordings";
const REPORT_STORE = "reports";
const EXPRESSION_STORE = "expressions";
const MIGRATION_KEY = "vocalis.history.migrated.v2";

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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to update the small local history index.", error instanceof DOMException ? error.name : "storage_error");
  }
}

export function loadSettings(): UserSettings {
  const stored = readJson<Partial<UserSettings>>(SETTINGS_KEY, {});
  const legacyVoiceByAccent = {
    "en-GB": "gb-female",
    "en-US": "us-female",
    "en-AU": "au-female",
    "en-IN": "in-female",
  } as const;
  const accent =
    stored.accent && Object.hasOwn(legacyVoiceByAccent, stored.accent)
      ? stored.accent
      : DEFAULT_SETTINGS.accent;
  const requestedVoice = stored.practiceVoiceId ?? legacyVoiceByAccent[accent];
  const safePracticeVoice = EXAMINER_VOICE_PRESETS.some(
    (voice) => voice.id === requestedVoice && voice.enabled,
  )
    ? requestedVoice
    : DEFAULT_SETTINGS.practiceVoiceId;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    accent,
    practiceVoiceId: safePracticeVoice,
    excludedAccents: Array.isArray(stored.excludedAccents)
      ? stored.excludedAccents
      : [],
  };
}

export function saveSettings(settings: UserSettings) {
  writeJson(SETTINGS_KEY, settings);
}

export function loadHistory(): HistoryRecord[] {
  const records = readJson<HistoryRecord[]>(HISTORY_KEY, []).map((record) => ({
    ...record,
    reportVersion: record.reportVersion ?? 1,
    reportComplete: record.reportComplete ?? false,
    reanalysisCount: record.reanalysisCount ?? 0,
  }));
  if (typeof window !== "undefined" && !window.localStorage.getItem(MIGRATION_KEY)) {
    writeJson(HISTORY_KEY, records);
    window.localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  }
  return records;
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
  if (typeof window !== "undefined")
    window.localStorage.removeItem(CHECKPOINT_KEY);
}

export function loadRecentTopicIds(): string[] {
  return readJson<string[]>(RECENT_TOPICS_KEY, []);
}

export function saveRecentTopicIds(ids: string[]) {
  writeJson(RECENT_TOPICS_KEY, [...new Set(ids)].slice(0, 12));
}

export interface RecentExaminerUsage {
  profileId: string;
  accent: Accent;
}

export function loadRecentExaminerUsage(): RecentExaminerUsage[] {
  return readJson<RecentExaminerUsage[]>(RECENT_EXAMINERS_KEY, [])
    .filter(
      (item) =>
        item &&
        typeof item.profileId === "string" &&
        typeof item.accent === "string",
    )
    .slice(0, 6);
}

export function saveRecentExaminerUsage(items: RecentExaminerUsage[]) {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.profileId}:${item.accent}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  writeJson(RECENT_EXAMINERS_KEY, unique.slice(0, 6));
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains(REPORT_STORE))
        request.result.createObjectStore(REPORT_STORE);
      if (!request.result.objectStoreNames.contains(EXPRESSION_STORE))
        request.result.createObjectStore(EXPRESSION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open audio database"));
  });
}

async function putValue(storeName: string, key: IDBValidKey, value: unknown) {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save local data"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local data transaction was aborted"));
  });
  db.close();
}

async function getValue<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openAudioDb();
  const result = await new Promise<T | null>((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Unable to read local data"));
  });
  db.close();
  return result;
}

async function deleteValue(storeName: string, key: IDBValidKey) {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to delete local data"));
  });
  db.close();
}

export function saveReportEnvelope(envelope: ReportEnvelope) {
  return putValue(REPORT_STORE, envelope.recordId, envelope);
}

export function loadReportEnvelope(recordId: string) {
  return getValue<ReportEnvelope>(REPORT_STORE, recordId);
}

export function deleteReportEnvelope(recordId: string) {
  return deleteValue(REPORT_STORE, recordId);
}

export async function loadExpressionLibrary(): Promise<ExpressionLibraryItem[]> {
  return (await getValue<ExpressionLibraryItem[]>(EXPRESSION_STORE, "library")) ?? [];
}

export function saveExpressionLibrary(items: ExpressionLibraryItem[]) {
  return putValue(EXPRESSION_STORE, "library", items);
}

export async function saveAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to save recording"));
  });
  db.close();
}

export async function loadAudioBlob(id: string): Promise<Blob | null> {
  const db = await openAudioDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(id);
    request.onsuccess = () =>
      resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to load recording"));
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
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to delete recording"));
  });
  db.close();
}

export async function deleteRecordAudio(record: HistoryRecord): Promise<void> {
  await Promise.all(
    record.segments.map((segment) =>
      deleteAudioBlob(segment.id).catch(() => undefined),
    ),
  );
}

export async function deleteHistoryData(record: HistoryRecord): Promise<void> {
  await Promise.all([
    record.recordingSaved ? deleteRecordAudio(record) : Promise.resolve(),
    deleteReportEnvelope(record.id).catch(() => undefined),
  ]);
}
