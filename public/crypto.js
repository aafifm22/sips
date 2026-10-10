// Kriptografi di browser: SHA-256, kanonisasi JSON, kunci ECDSA P-256 (tidak dapat diekspor) di IndexedDB.
const enc = new TextEncoder();
export const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async (d) => hex(await crypto.subtle.digest('SHA-256', typeof d === 'string' ? enc.encode(d) : d));
export function canon(o) {
  if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  return JSON.stringify(o === undefined ? null : o);
}
export const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const dataUrlBytes = (u) => unb64(u.split(',')[1]);

const idb = () => new Promise((res, rej) => { const r = indexedDB.open('ly-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function kv(mode, fn) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('k', mode), q = fn(t.objectStore('k')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); }
export const getKey = (uid) => kv('readonly', (s) => s.get('key:' + uid));
export const putKey = (uid, v) => kv('readwrite', (s) => s.put(v, 'key:' + uid));

export async function newKey() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const j = await crypto.subtle.exportKey('jwk', kp.publicKey), pub = { kty: j.kty, crv: j.crv, x: j.x, y: j.y };
  return { kid: (await sha256(canon(pub))).slice(0, 16), priv: kp.privateKey, pub };
}
export const signMsg = async (priv, msg) => b64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(msg)));
export async function verifySig(pub, msg, sigB64) {
  try {
    const k = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, unb64(sigB64), enc.encode(msg));
  } catch (e) { return false; }
}
/** Hash entri rantai. Harus identik di aplikasi dan verifikator offline. */
export const entryHashOf = (e) => sha256([e.seq, e.prevHash, e.docHash, e.recordHash, e.type, e.kid, e.at, e.no, e.serviceId, ...(e.soHash ? [e.soHash] : [])].join('|'));
/** Pesan yang ditandatangani tiap penandatangan: terikat pada hash isi surat (draftHash). */
export const soMsgOf = (draftHash, key, at) => `so|${draftHash}|${key}|${at}`;
export const sigMsgOf = (e) => `${e.seq}|${e.docHash}|${e.no}|${e.at}`;
export const GENESIS = '0'.repeat(64);
