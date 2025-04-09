# Fixing DEVELOPER_ERROR in Google Sign-In

If you're encountering a `DEVELOPER_ERROR` when trying to sign in with Google in TimeMaster v2, follow this troubleshooting guide to fix the issue.

## Understanding the Error

`DEVELOPER_ERROR` typically means there's a mismatch or configuration error in your Google Sign-In setup. The most common causes are:

1. **Incorrect Web Client ID** in your code
2. **Missing SHA-1 certificate fingerprint** in your Firebase project
3. **Google Sign-In API not enabled** in Google Cloud Console
4. **Package name mismatch** between your app and Firebase configuration

## Step 1: Check Web Client ID

The Web Client ID in your code must exactly match the one in your Firebase project.

1. Open `contexts/AuthContext.tsx`
2. Find the `WEB_CLIENT_ID` constant:
   ```typescript
   const WEB_CLIENT_ID = '224311261552-vu0hcpkrcalfk2a9a91j97uvbvb2h1qs.apps.googleusercontent.com';
   ```
3. Go to your Firebase Console > Project Settings > Your Android app
4. Scroll down to the "Web Client ID" field
5. Compare the two values - they must match exactly
6. If they don't match, update the `WEB_CLIENT_ID` in your code

## Step 2: Add SHA-1 Fingerprint to Firebase

Google Sign-In requires the SHA-1 fingerprint of your app's signing certificate.

1. Generate your debug SHA-1 key by running this in your project directory:
   ```
   cd android && ./gradlew signingReport
   ```
2. Look for the SHA-1 key under "Task :app:signingReport" > "Variant: debug" > "SHA-1"
3. Go to Firebase Console > Project Settings > Your Android app
4. Click "Add fingerprint"
5. Paste your SHA-1 key and save
6. Download the updated `google-services.json` file
7. Replace the existing file in `android/app/`

## Step 3: Enable Google Sign-In API

Make sure the Google Sign-In API is enabled in your Google Cloud project.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" > "Library"
4. Search for "Google Sign-In API" or "Google Identity Services"
5. Make sure both are enabled (click "Enable" if they're not)

## Step 4: Check Package Name

Ensure your app's package name matches the one registered in Firebase.

1. Check your `app.json` file for the Android package name:
   ```json
   "android": {
     "package": "com.healthydrugs.timemasterv2",
     ...
   }
   ```
2. In Firebase Console > Project Settings > Your Android app
3. Verify that the package name is exactly the same

## Step 5: Verify OAuth Configuration

1. Go to Google Cloud Console > "APIs & Services" > "OAuth consent screen"
2. Make sure the OAuth consent screen is properly configured
3. Add your email to the test users list if you're using an external user type

## Step 6: Rebuild the App

After making any changes:

1. Clean the project:
   ```
   cd android && ./gradlew clean
   ```
2. Rebuild the app:
   ```
   npx expo prebuild --clean
   npx expo run:android
   ```

## Using the Debug Screen

TimeMaster v2 includes a debug screen to help diagnose Google Sign-In issues:

1. On the login screen, tap "Debug Google Sign-In"
2. Review the information displayed
3. Check if Play Services are available on your device
4. Use this information to pinpoint the issue

## Common Error Messages and Solutions

### "The client ID contained in the request cannot be found"
- Your Web Client ID is incorrect or not registered properly
- Solution: Update the Web Client ID in `AuthContext.tsx`

### "DEVELOPER_ERROR: 10:"
- SHA-1 fingerprint is likely missing from Firebase
- Solution: Add your SHA-1 fingerprint to Firebase project settings

### "12500: Sign in failed, CANCELED"
- User canceled the sign-in process
- This is not an error, just a user action

### "12501: Sign in failed, SIGN_IN_REQUIRED"
- User isn't signed in yet
- This usually happens on the first sign-in attempt

### "12502: Sign in failed, NETWORK_ERROR"
- Check your internet connection
- Make sure Google Play Services is up to date

## Last Resort: Reset & Recreate

If all else fails, try these steps:

1. Delete your Android app from Firebase and recreate it
2. Generate a new SHA-1 key and add it to Firebase
3. Download a fresh `google-services.json` file
4. Reset the Google Cloud Console OAuth consent screen
5. Reconfigure everything from scratch

Remember that Google Sign-In is complex and requires precise configuration. Patient troubleshooting is often needed to get everything working correctly. 