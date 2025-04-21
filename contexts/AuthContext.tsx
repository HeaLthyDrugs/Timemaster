import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type AuthContextType = {
  user: User;
  isLoading: boolean;
};

// Create a default user
const DEFAULT_USER: User = {
  uid: 'default_user_id',
  email: null,
  displayName: 'Default User',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants for local storage
const USER_STORAGE_KEY = 'user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(DEFAULT_USER);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load default user information
    const initUser = async () => {
      setIsLoading(true);
      try {
        // Always set a default user
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USER));
        setUser(DEFAULT_USER);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsLoading(false);
      }
    };
    
    initUser();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading
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