# TimeMaster v2

A time tracking application built with React Native and Expo, featuring a local-first architecture for complete privacy and offline usage.

## Key Features

- Track time spent on different activities
- Categorize and analyze your time usage
- Complete offline functionality - all data stays on your device
- No server dependencies or internet connection required
- Multiple user profiles on a single device
- Detailed analytics and reporting

## Setup Instructions

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

The app uses a local authentication system with multiple options:

### Email/Password Authentication
- Users can sign up with a new email and password
- Existing users can sign in with their credentials
- Password reset functionality is available

### Demo/Guest Mode
- Users can access the app without creating an account
- Good for quick access or trial usage
- Data is still stored locally

## Data Storage

The app stores time sessions locally using AsyncStorage:
- Each user's data is stored in a dedicated storage key
- All data remains on the device for complete privacy
- No internet connection required

See [LOCAL_STORAGE_ARCHITECTURE.md](./LOCAL_STORAGE_ARCHITECTURE.md) for detailed information about the data architecture.

## Privacy & Security

- All data remains on your device - no server communication
- User authentication is handled locally
- Each user has their own isolated data collection

## App Structure

- `/app`: Main application screens and navigation
- `/components`: Reusable UI components
- `/contexts`: React context providers for global state
- `/hooks`: Custom hooks for shared functionality
- `/services`: Local storage and data management services
- `/types`: TypeScript type definitions

## Troubleshooting

If you encounter issues:
1. Make sure you have the latest dependencies installed
2. Clear AsyncStorage if you experience data corruption
3. Check the console for any error messages

## Additional Documentation

- [LOCAL_STORAGE_ARCHITECTURE.md](./LOCAL_STORAGE_ARCHITECTURE.md) - Local storage implementation details
- [INSTALLATION.md](./INSTALLATION.md) - Detailed installation instructions 