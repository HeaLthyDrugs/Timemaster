import { Platform } from 'react-native';

// Detect if we're in release or development mode
const isRelease = !__DEV__;

console.log(`App initializing in ${isRelease ? 'RELEASE' : 'DEVELOPMENT'} mode`);

// Export environment flag for conditional behavior throughout the app
export const isReleaseEnvironment = isRelease; 