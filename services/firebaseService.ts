import { db } from '../config/firebase';
import { TimeSession } from '../types/timeSession';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStorageKey = (userId: string) => `time_sessions_${userId}`;

// Function to sync local sessions with Firebase
export const syncSessionsWithFirebase = async (userId: string) => {
  try {
    // Get Firebase sessions first
    const firebaseSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .get();

    const firebaseSessions = firebaseSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : undefined
      };
    }) as TimeSession[];

    // Get local sessions
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

    // Merge strategies - prefer Firebase data if local storage is empty
    const mergedSessions = localSessions.length > 0 ? 
      mergeSessions(localSessions, firebaseSessions) : 
      firebaseSessions;

    // Update local storage with merged sessions
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(mergedSessions));

    return mergedSessions;
  } catch (error) {
    console.error('Error syncing sessions:', error);
    throw error;
  }
};

// Function to update sessions in Firebase
export const updateFirebaseSessions = async (userId: string, sessions: TimeSession[]) => {
  try {
    const batch = db.batch();
    const sessionsRef = db.collection('users').doc(userId).collection('sessions');

    // Clear existing sessions
    const existingSessions = await sessionsRef.get();
    existingSessions.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new sessions
    sessions.forEach(session => {
      const sessionRef = sessionsRef.doc(session.id);
      batch.set(sessionRef, {
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime ? session.endTime.toISOString() : null
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error updating Firebase sessions:', error);
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