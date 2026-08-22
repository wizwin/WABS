import { createContext } from 'react';
import axios from 'axios';

export const VERSION = '1.2.0';

// Use relative path in production to support network IPs, fallback to localhost for Vite dev server
export const API = window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';

export function getSessionToken() {
  return sessionStorage.getItem('wabs_session_token') || localStorage.getItem('wabs_session_token') || '';
}

export function setSessionToken(token, persist = true) {
  if (token) {
    sessionStorage.setItem('wabs_session_token', token);
    if (persist) {
      localStorage.setItem('wabs_session_token', token);
    }
    try {
      document.cookie = `wabs_session_token=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=${14 * 86400}`;
    } catch (e) {}
  } else {
    sessionStorage.removeItem('wabs_session_token');
    localStorage.removeItem('wabs_session_token');
    try {
      document.cookie = 'wabs_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    } catch (e) {}
  }
}

// Sync existing session token to cookie on startup for browser <img>, <video>, <audio> tags
try {
  const initToken = getSessionToken();
  if (initToken) {
    document.cookie = `wabs_session_token=${encodeURIComponent(initToken)}; path=/; SameSite=Lax; max-age=${14 * 86400}`;
  }
} catch (e) {}

// Global Axios Request Interceptor to attach X-Session-Token and prevent stale HTTP caching
axios.interceptors.request.use((config) => {
  const token = getSessionToken();
  config.headers = config.headers || {};
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';
  return config;
});

// Global Axios Interceptor to automatically retry requests if the SQLite database is locked
// and trigger lock screen on 401 Unauthorized responses
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const url = config?.url || "";
    const errorDetail = error.response?.data?.detail?.toLowerCase() || "";

    if (error.response && error.response.status === 401) {
      if (!url.includes('/auth/login') && !url.includes('/auth/change-pin') && !url.includes('/auth/disable-pin')) {
        window.dispatchEvent(new CustomEvent('wabs-auth-locked', { detail: { reason: 'unauthorized' } }));
      }
    }

    if (error.response && error.response.status === 500 && errorDetail.includes("locked")) {
      config._retryCount = config._retryCount || 0;
      if (config._retryCount < 3) {
        config._retryCount += 1;
        await new Promise(resolve => setTimeout(resolve, 1000 * config._retryCount)); // Exponential backoff (1s, 2s, 3s)
        return axios(config); // Retry the original request
      }
    }
    return Promise.reject(error);
  }
);

export const SettingsContext = createContext({ animationsEnabled: true, theme: 'dark' });

export const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
export const fileDateCache = new WeakMap();
export const placeholderCache = new Map();
export const sizeCache = new Map();

export function formatSize(size) {
  if (!size || size === '0') return '0 B';
  const str = String(size);
  if (sizeCache.has(str)) return sizeCache.get(str);
  const lastChar = str[str.length - 1];
  if ((lastChar >= 'A' && lastChar <= 'Z') || (lastChar >= 'a' && lastChar <= 'z')) {
    sizeCache.set(str, str);
    return str;
  }
  const bytes = parseFloat(str.replace(/,/g, ''));
  if (isNaN(bytes) || bytes === 0) {
    sizeCache.set(str, '0 B');
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const result = parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  sizeCache.set(str, result);
  return result;
}

export function parseFileDate(file) {
  if (fileDateCache.has(file)) return fileDateCache.get(file);
  let dateStr = (file.metadata?.date && String(file.metadata.date).trim()) ? file.metadata.date : file.modified;
  if (Array.isArray(dateStr)) {
    dateStr = dateStr[0];
  }
  if (!dateStr) {
    fileDateCache.set(file, null);
    return null;
  }
  if (typeof dateStr === 'string') {
    dateStr = dateStr.trim();
    if (dateStr.length >= 10 && dateStr[4] === ':' && dateStr[7] === ':') {
      dateStr = dateStr.substring(0, 4) + '-' + dateStr.substring(5, 7) + '-' + dateStr.substring(8);
    }
    dateStr = dateStr.replace(/\s+/, 'T');
  }
  const d = new Date(dateStr);
  const isValid = !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
  const res = isValid ? d : null;
  fileDateCache.set(file, res);
  return res;
}

export function validateFolderName(name) {
  if (!name || !name.trim()) {
    return 'Folder name cannot be empty.';
  }
  const trimmed = name.trim();
  const invalidChars = /[<>:"\/\\|?*]/;
  if (invalidChars.test(trimmed)) {
    return 'Folder name cannot contain any of the following characters: < > : " / \\ | ? *';
  }
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reservedNames.test(trimmed)) {
    return `"${trimmed}" is a reserved system name and cannot be used.`;
  }
  return null;
}