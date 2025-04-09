import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';

// With React Native Firebase, the configuration is automatically read from 
// the google-services.json file in the Android project
// and the GoogleService-Info.plist file in the iOS project

// Initialize Firebase if it hasn't been initialized already
if (!firebase.apps.length) {
  // @ts-ignore - React Native Firebase will read from native config files
  firebase.initializeApp();
}

// Get Firebase service instances
const db = firestore();
const authInstance = auth();
const crashlyticsInstance = crashlytics();

export { db, authInstance as auth, crashlyticsInstance as crashlytics }; 