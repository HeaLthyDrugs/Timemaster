# TimeMaster v2

A time tracking application built with React Native and Expo.

## Setup Instructions

### Firebase Configuration

1. **Create a Firebase Project:**
   - Go to the [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Add an Android app to your project with the package name `com.healthydrugs.timemasterv2`

2. **Download Configuration Files:**
   - Download the `google-services.json` file
   - Place it in the `android/app/` directory
   - For iOS, download the `GoogleService-Info.plist` file
   - Place it in the root of your project

3. **Enable Authentication Methods:**
   - Go to Authentication > Sign-in methods
   - Enable the following providers:
     - Email/Password
     - Google
     - Anonymous

4. **Configure Google Sign-In:**
   - Go to the Google Cloud Console for your Firebase project
   - Enable the Google Sign-In API
   - Create OAuth consent screen and credentials if needed
   - Make sure the Web Client ID in `AuthContext.tsx` matches your Firebase project
   - **⚠️ Troubleshooting:** If you encounter a `DEVELOPER_ERROR`, see [GOOGLE_AUTH_TROUBLESHOOTING.md](./GOOGLE_AUTH_TROUBLESHOOTING.md)

5. **Configure Firestore:**
   - Go to Firestore Database > Create database
   - Start in production mode
   - Choose a location close to your users

6. **Set Up Firestore Security Rules:**
   - Go to Firestore Database > Rules
   - Copy and paste the rules from the `firebase-security-rules.txt` file in this project

### Running the App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Run on Android:**
   ```bash
   npm run android
   ```

4. **Run on iOS:**
   ```bash
   npm run ios
   ```

## Authentication

The app uses Firebase Authentication for user management with multiple sign-in methods:

### Email/Password Authentication
- Users can sign up with a new email and password
- Existing users can sign in with their credentials
- Password reset functionality is available via email

### Google Authentication
- Users can sign in with their Google account
- Requires proper configuration in the Firebase console
- Google Services configuration files must be properly set up

### Anonymous Authentication
- Users can sign in anonymously without credentials
- Good for quick access or trial usage
- Data can later be linked to a permanent account if desired

## Data Storage

The app stores time sessions in two places:
- Locally using AsyncStorage
- In Firestore, synced when the user is authenticated

Each user's data is stored in a dedicated collection to ensure privacy and security.

## Security

Firestore security rules ensure that:
- Users can only access their own data
- Authentication is required for all operations
- Each user has their own isolated data collection

## Troubleshooting

If you encounter issues with Firebase:
1. Make sure `google-services.json` and `GoogleService-Info.plist` are properly placed
2. Check that the package name matches in your Firebase project
3. Verify that Firebase is properly initialized in the app
4. Check your security rules to ensure they allow the operations you're trying to perform
5. For Google Sign-In issues, verify that the `webClientId` matches your Firebase project's client ID

## Additional Documentation

- [INSTALLATION.md](./INSTALLATION.md) - Detailed installation instructions
- [GOOGLE_AUTH_TROUBLESHOOTING.md](./GOOGLE_AUTH_TROUBLESHOOTING.md) - Fixing Google Sign-In issues
- [IMPORTANT_NOTE.md](./IMPORTANT_NOTE.md) - Critical configuration notes 