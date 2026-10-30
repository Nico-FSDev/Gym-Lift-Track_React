import { Capacitor } from '@capacitor/core';

// Cloud Run production base URL for native APK deployments
const CLOUD_RUN_PROD_URL = 'https://ais-pre-w3gmvrdmbn6o6mxq4dacpk-52328800173.europe-west2.run.app';

/**
 * Returns the resolved full API URL based on runtime platform (Native APK vs Web)
 */
export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  if (Capacitor.isNativePlatform()) {
    // In native Android APK, relative /api paths would target capacitor://localhost or the local host.
    // Route to Cloud Run backend server.
    const customUrl = typeof window !== 'undefined' ? window.localStorage.getItem('custom_backend_url') : null;
    const baseUrl = customUrl || (import.meta.env.VITE_API_BASE_URL as string) || CLOUD_RUN_PROD_URL;
    return `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`;
  }
  
  // On web, relative path uses the same-origin or reverse-proxy server
  return normalizedPath;
}

/**
 * Standard fetch wrapper that ensures correct API routing, JSON headers, and error handling across Native and Web
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
