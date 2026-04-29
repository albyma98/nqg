const DB_NAME = 'nightquest-outbox';
const STORE_NAME = 'geo-updates';
const DB_VERSION = 1;
const MAX_QUEUE_LENGTH = 200;

function isAvailable() {
    return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb() {
    if (!isAvailable()) return Promise.resolve(null);
    return new Promise((resolve) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => resolve(null);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('sessionId', 'sessionId', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

function tx(mode, fn) {
    return openDb().then((db) => {
        if (!db) return null;
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            Promise.resolve(fn(store))
                .then((value) => {
                    transaction.oncomplete = () => resolve(value);
                    transaction.onerror = () => resolve(null);
                })
                .catch(() => resolve(null));
        });
    });
}

export async function enqueueGeoUpdate(sessionId, payload) {
    await tx('readwrite', async (store) => {
        const countRequest = store.count();
        await new Promise((resolve) => {
            countRequest.onsuccess = () => resolve();
            countRequest.onerror = () => resolve();
        });
        if (countRequest.result >= MAX_QUEUE_LENGTH) {
            const cursorRequest = store.openCursor();
            await new Promise((resolve) => {
                cursorRequest.onsuccess = () => {
                    const cursor = cursorRequest.result;
                    if (cursor) cursor.delete();
                    resolve();
                };
                cursorRequest.onerror = () => resolve();
            });
        }
        store.add({ sessionId, payload, queuedAt: Date.now() });
    });
}

export async function listOutboxEntries(sessionId) {
    const result = await tx('readonly', (store) => {
        return new Promise((resolve) => {
            const index = store.index('sessionId');
            const request = index.getAll(IDBKeyRange.only(sessionId));
            request.onsuccess = () => resolve(request.result ?? []);
            request.onerror = () => resolve([]);
        });
    });
    return result ?? [];
}

export async function deleteOutboxEntry(id) {
    await tx('readwrite', (store) => {
        store.delete(id);
    });
}

export async function clearOutbox(sessionId) {
    await tx('readwrite', (store) => {
        return new Promise((resolve) => {
            const index = store.index('sessionId');
            const request = index.openKeyCursor(IDBKeyRange.only(sessionId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => resolve();
        });
    });
}

export async function flushOutbox(sessionId, send) {
    const entries = await listOutboxEntries(sessionId);
    let flushed = 0;
    for (const entry of entries) {
        try {
            await send(entry.payload);
            await deleteOutboxEntry(entry.id);
            flushed += 1;
        }
        catch {
            return { flushed, remaining: entries.length - flushed };
        }
    }
    return { flushed, remaining: 0 };
}
