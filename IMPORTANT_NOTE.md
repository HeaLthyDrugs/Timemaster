# IMPORTANT NOTE

## Google Services Configuration

Before running `npx expo prebuild`, make sure you have:

1. Downloaded the `google-services.json` file from your Firebase Console
2. Placed it in the root directory of your project AND in the `android/app/` directory
3. For iOS projects, downloaded the `GoogleService-Info.plist` file and placed it in the root directory

If these files are missing, the prebuild process will fail with errors like:

```
Error: ENOENT: no such file or directory, open 'C:\ROOT\Personal\app\timemasterv2\google-services.json'
```

## Web Client ID

Make sure to update the `webClientId` in `contexts/AuthContext.tsx` with your actual Web Client ID from the Google Cloud Console. The current placeholder value must be replaced with your own project's client ID.

## Testing the Authentication

To test the authentication methods:

1. Complete the Firebase setup as described in INSTALLATION.md
2. Make sure all the configuration files are in place
3. Run the app on a device or emulator
4. Try each authentication method and verify it works as expected

If you encounter any issues, check the logs and the Firebase Console for error details. 