import type { Job } from "./types";

/**
 * Database local (IndexedDB) lưu lịch sử tạo ảnh/video.
 * Dữ liệu nằm hoàn toàn trên trình duyệt của người dùng nên
 * tải lại trang (F5) không làm mất kết quả.
 */

const DB_NAME = "aurora-studio-db";
const STORE = "jobs";
const VERSION = 1;

export type StoredJob = Omit<Job, "resultUrl" | "previewUrl"> & {
  /** Ảnh lưu dạng data URL */
  resultData?: string;
  /** Video lưu dạng Blob (tạo lại object URL khi nạp) */
  resultBlob?: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không mở được database local"));
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lỗi ghi/đọc database local"));
  });
}

export async function loadStoredJobs(): Promise<StoredJob[]> {
  const db = await openDb();
  try {
    const all = await tx(db, "readonly", (store) => store.getAll() as IDBRequest<StoredJob[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function putStoredJob(job: StoredJob): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "readwrite", (store) => store.put(job));
  } finally {
    db.close();
  }
}

export async function deleteStoredJob(id: string): Promise<void> {
  const db = await openDb();
  try {
    await tx(db, "readwrite", (store) => store.delete(id));
  } finally {
    db.close();
  }
}
