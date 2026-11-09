// Keep the last-used media files in IndexedDB so a page refresh doesn't lose them.
// Everything is wrapped: if storage is blocked or full, the app just carries on.
const DB = 'arav-media', ST = 'files';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  try {
    const d = await db();
    return await new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
  } catch (e) { console.warn('IndexedDB:', e); return undefined; }
}
export const putFile = (key, file) => (file && file.size < 600e6 ? tx('readwrite', s => s.put(file, key)) : Promise.resolve());
export const getFile = key => tx('readonly', s => s.get(key));
export const delFile = key => tx('readwrite', s => s.delete(key));
export const keys = () => tx('readonly', s => s.getAllKeys());
