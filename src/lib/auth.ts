import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { 
  GoogleAuthProvider, 
  signInWithCredential, 
  signInWithPopup, 
  UserCredential,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export const SERVER_CLIENT_ID = 
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || 
  '40150413250-b37nnttausajrvv4fccf8bmfnl1eoc92.apps.googleusercontent.com';

let isGoogleAuthInitialized = false;

/**
 * Initializes native GoogleAuth plugin on native platforms (Android/iOS)
 */
export async function initNativeGoogleAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform() || isGoogleAuthInitialized) return;

  try {
    await GoogleAuth.initialize({
      clientId: SERVER_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
    isGoogleAuthInitialized = true;
    console.log('[NativeAuth] GoogleAuth initialized with serverClientId:', SERVER_CLIENT_ID);
  } catch (err) {
    console.warn('[NativeAuth] GoogleAuth initialization warning:', err);
  }
}

/**
 * Executes native Google Sign-In with Firebase bridge.
 * Returns UserCredential on success, or null if cancelled by user.
 */
export async function performGoogleSignIn(): Promise<UserCredential | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      await initNativeGoogleAuth();

      console.log('[NativeAuth] Triggering native Google Sign-In dialog...');
      const googleUser = await GoogleAuth.signIn();

      if (!googleUser || !googleUser.authentication) {
        console.warn('[NativeAuth] No authentication token returned from GoogleAuth');
        return null;
      }

      const idToken = googleUser.authentication?.idToken || (googleUser as any)?.idToken;
      const accessToken = googleUser.authentication?.accessToken || (googleUser as any)?.accessToken;

      if (!idToken) {
        throw new Error('Google Sign-In failed: missing idToken from native response');
      }

      console.log('[NativeAuth] Native credential obtained. Authenticating with Firebase...');
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      console.log('[NativeAuth] Firebase authenticated successfully:', userCredential.user.uid);
      return userCredential;
    } catch (error: any) {
      // Catch and gracefully handle user cancellation (12501 / canceled by user)
      const errStr = String(error?.message || error?.code || error || '');
      const isCancellation = 
        error?.code === '12501' || 
        error === 12501 || 
        errStr.includes('12501') || 
        errStr.toLowerCase().includes('cancel') ||
        errStr.toLowerCase().includes('user closed');

      if (isCancellation) {
        console.log('[NativeAuth] Google Sign-In dismissed/cancelled by user. Suppressing error.');
        return null; // Gracefully return null without error
      }

      console.error('[NativeAuth] Native Google Sign-In error details:', {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        fullError: error
      });

      // Provide clear actionable guidance for Google Play Services CommonStatusCodes
      const code = String(error?.code || error?.statusCode || '');
      if (code === '10' || errStr.includes('10') || errStr.toLowerCase().includes('something went wrong')) {
        throw new Error(
          'Google Sign-In Developer Error (Code 10): The APK\'s SHA-1 certificate fingerprint or Web Client ID is missing in Firebase Console.'
        );
      } else if (code === '7') {
        throw new Error('Google Sign-In Network Error (Code 7): Please check your internet connection and try again.');
      } else if (code === '12500') {
        throw new Error('Google Sign-In Failed (Code 12500): Check that Google Sign-In is enabled in your Firebase Console.');
      }

      throw error;
    }
  }

  // Web fallback: Standard Firebase popup
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (webError: any) {
    if (
      webError.code === 'auth/popup-closed-by-user' || 
      webError.code === 'auth/cancelled-popup-request'
    ) {
      console.log('[WebAuth] User closed login popup.');
      return null;
    }
    throw webError;
  }
}

/**
 * Handles unified sign-out across both native GoogleAuth session and Firebase
 */
export async function performSignOut(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await GoogleAuth.signOut().catch(() => {});
    }
  } catch (err) {
    console.warn('[NativeAuth] Error during native Google signout:', err);
  }
  return firebaseSignOut(auth);
}
