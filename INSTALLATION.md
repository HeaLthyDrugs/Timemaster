# TimeMaster v2 - Installation Guide

This guide provides detailed instructions on how to set up Firebase authentication for TimeMaster v2, including Email/Password, Google, and Anonymous authentication.

## Prerequisites

1. Node.js and npm installed
2. Expo CLI installed (`npm install -g expo-cli`)
3. A Firebase account

## Setting Up Firebase Project

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name (e.g., "TimeMaster")
4. Enable or disable Google Analytics (recommended: enable)
5. Select your Google Analytics account or create a new one
6. Click "Create project"

### 2. Configure Android App

1. In your Firebase project dashboard, click the Android icon to add an Android app
2. Enter package name: `com.healthydrugs.timemasterv2`
3. Enter app nickname: "TimeMaster v2" (optional)
4. Skip the debug signing certificate for now
5. Click "Register app"
6. Download the `google-services.json` file
7. Place the file in the `android/app/` directory of your project

### 3. Configure iOS App (if using iOS)

1. In your Firebase project dashboard, click the iOS icon to add an iOS app
2. Enter bundle ID: `com.healthydrugs.timemasterv2`
3. Enter app nickname: "TimeMaster v2" (optional)
4. Skip the App Store ID for now
5. Click "Register app"
6. Download the `GoogleService-Info.plist` file
7. Place the file in the root directory of your project

## Setting Up Authentication Methods

### 1. Email/Password Authentication

1. In the Firebase Console, go to "Authentication" > "Sign-in method"
2. Click on "Email/Password"
3. Toggle the "Enable" switch
4. Click "Save"

### 2. Google Authentication

1. In the Firebase Console, go to "Authentication" > "Sign-in method"
2. Click on "Google"
3. Toggle the "Enable" switch
4. Enter your support email
5. Click "Save"

#### Configure Google Sign-In

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to "APIs & Services" > "OAuth consent screen"
4. Select "External" and click "Create"
5. Fill in the required information (App name, user support email, developer contact)
6. Click "Save and Continue"
7. Add necessary scopes (at minimum: `email` and `profile`)
8. Click "Save and Continue" and finish the OAuth consent screen setup

9. In Google Cloud Console, go to "APIs & Services" > "Credentials"
10. Click "Create Credentials" > "OAuth client ID"
11. Select "Web application" for the Application type
12. Add a name (e.g., "TimeMaster Web Client")
13. Add an authorized JavaScript origin: `https://timemasterv2.firebaseapp.com`
14. Click "Create"
15. Note the "Client ID" - you'll need to use this in your app

16. Open `contexts/AuthContext.tsx` and update the `webClientId` with your client ID:
    ```typescript
    GoogleSignin.configure({
      webClientId: 'YOUR_WEB_CLIENT_ID_HERE',
    });
    ```

### 3. Anonymous Authentication

1. In the Firebase Console, go to "Authentication" > "Sign-in method"
2. Click on "Anonymous"
3. Toggle the "Enable" switch
4. Click "Save"

## Setting Up Firestore

1. In the Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location close to your users
5. Click "Enable"

## Configuring Security Rules

1. In the Firebase Console, go to "Firestore Database" > "Rules"
2. Replace the default rules with the rules from `firebase-security-rules.txt`
3. Click "Publish"

## Running the App

1. Install dependencies:
   ```bash
   npm install
   ```

2. Update the Expo configuration:
   ```bash
   npx expo prebuild
   ```

3. Start the app:
   ```bash
   npm start
   ```

4. Run on Android:
   ```bash
   npm run android
   ```

5. Run on iOS:
   ```bash
   npm run ios
   ```

## Troubleshooting

### Google Sign-In Issues

- Make sure the `webClientId` in `AuthContext.tsx` matches the Client ID from Google Cloud Console
- Verify that Google Play Services are installed on your Android device/emulator
- For iOS, ensure the `GoogleService-Info.plist` file is correctly placed

### Firebase Authentication Issues

- Check Firebase Console logs for any authentication errors
- Ensure your app's package name/bundle ID matches what's registered in Firebase
- Verify that all authentication methods are enabled in the Firebase Console

### Firestore Issues

- Check that security rules allow the operations you're trying to perform
- Ensure users are properly authenticated before trying to access Firestore
- Check for any quota limitations on your Firebase plan 