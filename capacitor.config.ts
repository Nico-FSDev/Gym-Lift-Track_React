import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gym.lift.track',
  appName: 'Gym Lift Track',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'gym-lift-track.firebaseapp.com',
    cleartext: true,
    allowNavigation: [
      'gym-lift-track.firebaseapp.com',
      '*.firebaseapp.com',
      'accounts.google.com',
      'apis.google.com'
    ]
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '40150413250-b37nnttausajrvv4fccf8bmfnl1eoc92.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
