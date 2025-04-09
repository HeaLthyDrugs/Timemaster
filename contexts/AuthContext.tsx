import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authInstance } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';

type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize Google Sign-In
// Make sure this webClientId matches exactly with your Firebase web client ID
const WEB_CLIENT_ID = '224311261552-6q6388s1ma2cbspj2iqfh158psv49knd.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
});

console.log('Google Sign In configured with WebClientID:', WEB_CLIENT_ID);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      setIsLoading(true);
      try {
        // Check stored user
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        
        // Listen for auth state changes
        const unsubscribe = authInstance.onAuthStateChanged(async (firebaseUser: FirebaseAuthTypes.User | null) => {
          if (firebaseUser) {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
            };
            setUser(userData);
            await AsyncStorage.setItem('user', JSON.stringify(userData));
          } else {
            setUser(null);
            await AsyncStorage.removeItem('user');
          }
          setIsLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Auth state error:', error);
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await authInstance.signInWithEmailAndPassword(email, password);
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await authInstance.createUserWithEmailAndPassword(email, password);
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('Starting Google Sign In process...');
      
      // Check if your device supports Google Play
      console.log('Checking Google Play Services...');
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        console.log('Google Play Services available');
      } catch (error: any) {
        console.error('Google Play Services error:', error);
        Alert.alert('Google Play Services Error', 
          `Error code: ${error.code}\nMessage: ${error.message}`);
        throw error;
      }
      
      // Check if already signed in with Google
      console.log('Checking if already signed in with Google...');
      const isSignedIn = await GoogleSignin.isSignedIn();
      console.log('Is already signed in with Google:', isSignedIn);
      
      if (isSignedIn) {
        console.log('Already signed in, signing out first...');
        await GoogleSignin.signOut();
      }
      
      // Get the users ID token
      console.log('Attempting to get ID token from Google...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign In successful for user:', userInfo.user.email);
      
      if (!userInfo.idToken) {
        throw new Error('No ID token returned from Google');
      }
      
      console.log('ID token obtained, creating Firebase credential...');
      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(userInfo.idToken);
      
      // Sign-in the user with the credential
      console.log('Signing in to Firebase with Google credential...');
      const result = await authInstance.signInWithCredential(googleCredential);
      console.log('Firebase sign in successful for user:', result.user.email);
      
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      console.error('Google Sign In error:', error);
      
      // Handle specific error codes
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled the sign in flow');
        Alert.alert('Sign In Cancelled', 'You cancelled the sign in process');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign in is in progress already');
        Alert.alert('In Progress', 'Sign in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('Play services not available or outdated');
        Alert.alert('Play Services', 'Google Play services is not available or outdated');
      } else {
        console.log('Unknown error:', error);
        Alert.alert('Authentication Error', 
          `Error code: ${error.code || 'unknown'}\nMessage: ${error.message || 'An unknown error occurred'}`);
      }
      
      throw error;
    }
  };

  const signInAnonymously = async () => {
    try {
      console.log('Starting anonymous sign in...');
      const result = await authInstance.signInAnonymously();
      console.log('Anonymous sign in successful for user ID:', result.user.uid);
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      console.error('Anonymous sign in error:', error);
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      
      // Get current user ID before signing out
      const currentUser = authInstance.currentUser;
      const userId = currentUser?.uid;

      // Check if signed in with Google
      const isSignedInWithGoogle = await GoogleSignin.isSignedIn();
      if (isSignedInWithGoogle) {
        console.log('Signing out from Google...');
        await GoogleSignin.signOut();
      }

      // Clear user's sessions from AsyncStorage if we have a userId
      if (userId) {
        console.log('Clearing user sessions...');
        await AsyncStorage.removeItem(`time_sessions_${userId}`);
      }

      console.log('Signing out from Firebase...');
      await authInstance.signOut();
      console.log('Sign out successful');
      router.replace('/login' as any);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      console.log('Sending password reset email to:', email);
      await authInstance.sendPasswordResetEmail(email);
      console.log('Password reset email sent');
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw new Error(error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      signIn, 
      signUp, 
      signInWithGoogle,
      signInAnonymously,
      signOut, 
      forgotPassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 