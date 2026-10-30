import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { performGoogleSignIn, performSignOut } from './lib/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// In modern web proxies, iframe environments, and Capacitor WebViews,
// WebChannel full-duplex streaming can be buffered by reverse proxies or sandboxes,
// leading to a 10s backend timeout ("Could not reach Cloud Firestore backend").
// Enabling experimentalForceLongPolling forces standard HTTP long-polling which passes
// seamlessly through all reverse proxies and iframes with persistent offline cache.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// Connection test to Firestore backend as mandated by Firebase integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration: Firestore client is offline.");
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Check redirect result on startup (essential for mobile & redirect flows)
if (typeof window !== 'undefined') {
    getRedirectResult(auth).catch((err) => {
        console.warn('Firebase getRedirectResult error:', err);
    });
}

export const loginWithGoogle = async () => {
    return performGoogleSignIn();
};

export const logout = async () => {
    return performSignOut();
};
