// src/storage.js — the one way to reach localStorage: it can throw (private mode, blocked site data), so this returns null then.
// Modules that keep user data take a storage argument (log.js, favorites.js, …); DOM modules get theirs here.
export const safeStorage = () => { try { return localStorage; } catch { return null; } };

// Single-key helpers for DOM modules that keep one small string. Blocked storage reads as null / write is dropped (setStr returns false).
export const getStr = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
export const setStr = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
export const removeStr = (key) => { try { localStorage.removeItem(key); return true; } catch { return false; } };
