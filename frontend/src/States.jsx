import { createContext } from 'react';
import axios from 'axios';

export const VERSION = '1.0.1';

// Use relative path in production to support network IPs, fallback to localhost for Vite dev server
export const API = window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';

// Global Axios Interceptor to automatically retry requests if the SQLite database is locked
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const errorDetail = error.response?.data?.detail?.toLowerCase() || "";
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

export const dateFormatter = new Intl.DateTimeFormat('default', { month: 'short', year: 'numeric' });
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
  let dateStr = file.metadata?.date || file.modified;
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
  const res = isNaN(d.getTime()) ? null : d;
  fileDateCache.set(file, res);
  return res;
}