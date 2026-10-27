// src/storage.js — the one way to reach localStorage: it can throw (private mode, blocked site data), so this returns null then.
// Modules that keep user data take a storage argument (log.js, favorites.js, …); DOM modules get theirs here.
export const safeStorage = () => { try { return localStorage; } catch { return null; } };
