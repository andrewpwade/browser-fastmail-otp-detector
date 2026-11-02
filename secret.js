// The API token is stored encrypted: AES-GCM with a key that lives in IndexedDB as a
// non-extractable CryptoKey, so the key's bytes can't be read out of the profile. Anyone who copies
// the profile's storage files (a backup, a synced folder, a stolen disk image) gets ciphertext.
//
// This does NOT stop code running inside the browser as this extension, or malware running as the
// user, from using the key. It is a barrier for copied files, not a vault. Use a read-only token.

const DB = "mail-code-copy", STORE = "keys", KEY_ID = "token-key";

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// The stored key, creating it on first use. Check-then-store happens in one IndexedDB transaction,
// so the background script and the setup page can't each create a different key.
async function key() {
  const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let chosen;
      const get = store.get(KEY_ID);
      get.onsuccess = () => {
        chosen = get.result ?? fresh;
        if (!get.result) store.put(fresh, KEY_ID);
      };
      tx.oncomplete = () => { db.close(); resolve(chosen); };
      tx.onerror = tx.onabort = () => reject(tx.error);
    };
  });
}

async function encrypt(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(text));
  return { iv: b64(iv), data: b64(data) };
}

const decrypt = async ({ iv, data }) =>
  new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(data)));

export async function setToken(token) {
  await chrome.storage.local.set({ token: await encrypt(token) });
}

// The token, or null if none is stored or it can't be decrypted (the key is gone, e.g. the profile
// was copied to another machine); an unreadable token is removed so the user is asked to reconnect.
// A plain-text token saved by an older version is encrypted on first read.
export async function getToken() {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return null;
  if (typeof token === "string") {
    await setToken(token);
    return token;
  }
  try {
    return await decrypt(token);
  } catch {
    await chrome.storage.local.remove("token");
    return null;
  }
}
