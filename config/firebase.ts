import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';

// Detect if we're in release or development mode
// This is crucial for ensuring we use the right Firebase project in each environment
const isRelease = !__DEV__;

console.log(`Firebase initializing in ${isRelease ? 'RELEASE' : 'DEVELOPMENT'} mode`);

// Firebase configuration options
// With React Native Firebase v6+, the configuration is automatically read from 
// the google-services.json file in the Android project
// and the GoogleService-Info.plist file in the iOS project

// Initialize Firebase if it hasn't been initialized already
if (!firebase.apps.length) {
  // @ts-ignore - React Native Firebase will read from native config files
  firebase.initializeApp();
}

// Configure Firestore persistence for better offline support
firestore().settings({
  persistence: true, // Enable offline persistence
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED, // Allow unlimited cache size
});

// Get Firebase service instances
const db = firestore();
const authInstance = auth();
const crashlyticsInstance = crashlytics();

// Export environment flag for conditional behavior throughout the app
export const isReleaseEnvironment = isRelease;

export { db, authInstance as auth, crashlyticsInstance as crashlytics }; 