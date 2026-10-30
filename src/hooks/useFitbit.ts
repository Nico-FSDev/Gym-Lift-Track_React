import { useState, useCallback, useEffect } from 'react';

const FITBIT_CLIENT_ID = import.meta.env.VITE_FITBIT_CLIENT_ID || '';
// In development/preview we might need to rely on the current window origin
const REDIRECT_URI = window.location.origin;

// PKCE Helper functions
const generateRandomString = (length: number) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (a: ArrayBuffer) => {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(a))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export function useFitbit() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for returning auth code on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      handleCallback(code);
    }
  }, []);

  const login = async () => {
    if (!FITBIT_CLIENT_ID) {
      setError("Fitbit Client ID is not configured. Please add VITE_FITBIT_CLIENT_ID to your environment variables.");
      return;
    }

    try {
      const codeVerifier = generateRandomString(128);
      window.localStorage.setItem('fitbit_code_verifier', codeVerifier);
      
      const hashed = await sha256(codeVerifier);
      const codeChallenge = base64urlencode(hashed);

      const authUrl = new URL('https://www.fitbit.com/oauth2/authorize');
      authUrl.searchParams.append('client_id', FITBIT_CLIENT_ID);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('scope', 'weight profile');
      // The redirect_uri must exactly match what is registered in the Fitbit developer console
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);

      window.location.href = authUrl.toString();
    } catch (err: any) {
      setError(err.message || "Failed to start Fitbit login.");
    }
  };

  const handleCallback = async (code: string) => {
    setIsSyncing(true);
    try {
      const codeVerifier = window.localStorage.getItem('fitbit_code_verifier');
      if (!codeVerifier) {
        throw new Error("Missing code verifier. Auth flow interrupted.");
      }

      const params = new URLSearchParams();
      params.append('client_id', FITBIT_CLIENT_ID);
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('code_verifier', codeVerifier);
      params.append('redirect_uri', REDIRECT_URI);

      const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || 'Failed to exchange token');
      }

      window.localStorage.setItem('fitbit_access_token', data.access_token);
      window.localStorage.setItem('fitbit_refresh_token', data.refresh_token);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to complete Fitbit login.");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchBodyMetrics = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    
    try {
      const accessToken = window.localStorage.getItem('fitbit_access_token');
      if (!accessToken) {
        throw new Error("Not logged in");
      }

      // Fetch latest weight
      const weightResponse = await fetch('https://api.fitbit.com/1/user/-/body/log/weight/date/today/1m.json', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      // Fetch latest fat
      const fatResponse = await fetch('https://api.fitbit.com/1/user/-/body/log/fat/date/today/1m.json', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (weightResponse.status === 401 || fatResponse.status === 401) {
        // Token expired, needs re-authentication (simplified for this integration, ideally we use refresh_token)
        window.localStorage.removeItem('fitbit_access_token');
        throw new Error("Session expired. Please reconnect Fitbit.");
      }

      const weightData = await weightResponse.json();
      const fatData = await fatResponse.json();

      const latestWeight = weightData.weight?.[weightData.weight.length - 1];
      const latestFat = fatData.fat?.[fatData.fat.length - 1];

      if (!latestWeight && !latestFat) {
        throw new Error("No recent body composition data found in Fitbit.");
      }

      return {
        weight: latestWeight?.weight, // in configured units, usually kg or lbs based on account settings, but Fitbit API defaults to metric if not specified by Accept-Language, though actually weight is in the user's preferred unit or kg. Usually the `weight` property is returned.
        fat: latestFat?.fat,
        date: latestWeight?.date || latestFat?.date
      };

    } catch (err: any) {
      setError(err.message || "Failed to sync with Fitbit.");
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    login,
    fetchBodyMetrics,
    isSyncing,
    error,
    isLoggedIn: !!window.localStorage.getItem('fitbit_access_token')
  };
}
