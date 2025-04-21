import { TimeSession } from '../types/timeSession';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStorageKey = (userId: string) => `time_sessions_${userId}`;

// Function to sync local sessions (no Firebase involved)
export const syncSessionsWithFirebase = async (userId: string) => {
  try {
    // Just get local sessions
    const storedSessions = await AsyncStorage.getItem(getStorageKey(userId));
    let localSessions: TimeSession[] = [];
    
    if (storedSessions) {
      const parsed = JSON.parse(storedSessions);
      localSessions = parsed.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined
      }));
    }

    // Return local sessions directly
    console.log(`[Local] Found ${localSessions.length} local sessions for user ${userId}`);
    return localSessions;
  } catch (error) {
    console.error('Error accessing local sessions:', error);
    throw error;
  }
};

// Function to update sessions in local storage
export const updateFirebaseSessions = async (userId: string, sessions: TimeSession[]) => {
  try {
    // Save sessions directly to local storage
    const storageKey = getStorageKey(userId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
    console.log(`[Local] Saved ${sessions.length} sessions for user ${userId}`);
  } catch (error) {
    console.error('Error saving local sessions:', error);
    throw error;
  }
};

// Helper function to merge local and Firebase sessions
const mergeSessions = (localSessions: TimeSession[], firebaseSessions: TimeSession[]): TimeSession[] => {
  const mergedMap = new Map<string, TimeSession>();

  // Add Firebase sessions first (they take precedence)
  firebaseSessions.forEach(session => {
    mergedMap.set(session.id, session);
  });

  // Add local sessions only if they don't exist in Firebase
  localSessions.forEach(session => {
    if (!mergedMap.has(session.id)) {
      mergedMap.set(session.id, session);
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => 
    b.startTime.getTime() - a.startTime.getTime()
  );
}; 