import { TimeSession, SyncStatus } from '~/types/timeSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { Platform } from 'react-native';
import { InteractionManager } from 'react-native';

// Storage keys
const getStorageKey = (userId: string) => `time_sessions_${userId}`;
const getLastSyncKey = (userId: string) => `last_sync_${userId}`;

// Local storage constants
const BATCH_SIZE = 20;

// Utility functions
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Update a local session in AsyncStorage
 */
async function updateLocalSession(updatedSession: TimeSession): Promise<void> {
  if (!updatedSession.userId) return;

  try {
    const storageKey = getStorageKey(updatedSession.userId);
    const storedSessions = await AsyncStorage.getItem(storageKey);
    let sessions: TimeSession[] = [];
    
    if (storedSessions) {
      sessions = JSON.parse(storedSessions);
      
      // Find and update the session
      const index = sessions.findIndex(s => s.id === updatedSession.id);
      if (index !== -1) {
        sessions[index] = updatedSession;
      } else {
        sessions.push(updatedSession);
      }
    } else {
      sessions = [updatedSession];
    }
    
    await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to update local session:', error);
    throw error;
  }
}

/**
 * Mark a session for local sync
 */
export async function markForSync(session: TimeSession): Promise<TimeSession> {
  if (!session || !session.userId) return session;
  
  // Mark as pending sync
  const sessionToSync: TimeSession = {
    ...session,
    syncStatus: 'synced', // In local-only mode, we always consider it synced
    updatedAt: new Date()
  };
  
  // Update in local storage
  await updateLocalSession(sessionToSync);
  
  return sessionToSync;
}

/**
 * Save active session locally
 */
async function syncActiveSession(session: TimeSession): Promise<void> {
  if (!session || !session.isActive || !session.userId) return;
  
  try {
    // Mark as synced (local-only mode doesn't need sync statuses)
    const syncedSession: TimeSession = {
      ...session,
      syncStatus: 'synced' as SyncStatus,
      updatedAt: new Date(),
    };
    
    await updateLocalSession(syncedSession);
    
    console.log(`[Local] Active session ${session.id} saved locally`);
  } catch (error) {
    console.error('Failed to save active session locally:', error);
  }
}

// Throttled function for saving active session
export const syncActiveSessionThrottled = throttle(syncActiveSession, 5000);

/**
 * Process all pending sessions locally
 */
export async function syncAllPendingSessions(userId: string): Promise<void> {
  if (!userId) return;
  
  try {
    console.log(`[Local] Processing all sessions for user ${userId}`);
    
    // Get all sessions from local storage
    const storageKey = getStorageKey(userId);
    const storedSessions = await AsyncStorage.getItem(storageKey);
    const sessions: TimeSession[] = storedSessions ? JSON.parse(storedSessions) : [];
    
    // Convert date strings to Date objects
    const parsedSessions = sessions.map((session: any) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
      syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined,
      lastSyncAttempt: session.lastSyncAttempt ? new Date(session.lastSyncAttempt) : undefined
    }));
    
    // Find sessions marked for deletion
    const sessionsToDelete = parsedSessions.filter(session => 
      session.deleted === true
    );
    
    if (sessionsToDelete.length === 0) {
      console.log('[Local] No sessions to delete');
      return;
    }
    
    console.log(`[Local] Found ${sessionsToDelete.length} sessions to delete`);
    
    // Remove deleted sessions from local storage
    const updatedSessions = parsedSessions.filter(session => !session.deleted);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSessions));
    
    // Update last sync timestamp
    await AsyncStorage.setItem(getLastSyncKey(userId), new Date().toISOString());
    
    console.log('[Local] All sessions processed successfully');
  } catch (error) {
    console.error('Failed to process sessions locally:', error);
  }
}

/**
 * Initialize app state listeners
 */
export function initSyncListeners(userId: string, onSyncComplete?: () => void) {
  if (!userId) return null;

  // Listen for app state changes (foreground/background)
  const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground
      syncAllPendingSessions(userId).catch(console.error);
      if (onSyncComplete) onSyncComplete();
    }
  });

  // Return cleanup function
  return () => {
    appStateSubscription.remove();
  };
}

/**
 * Load sessions from local storage
 */
export async function pullRemoteSessions(userId: string): Promise<void> {
  if (!userId) return;
  
  try {
    console.log(`[Local] Loading sessions for user ${userId}`);
    
    // Get local sessions
    const storageKey = getStorageKey(userId);
    const storedSessions = await AsyncStorage.getItem(storageKey);
    let localSessions: TimeSession[] = storedSessions 
      ? JSON.parse(storedSessions) 
      : [];
    
    console.log(`[Local] Found ${localSessions.length} local sessions`);
    
    // Process deleted sessions
    const sessionsToDelete = localSessions.filter(session => session.deleted === true);
    if (sessionsToDelete.length > 0) {
      console.log(`[Local] Found ${sessionsToDelete.length} sessions marked for deletion`);
      
      // Remove deleted sessions from local storage
      const nonDeletedSessions = localSessions.filter(session => !session.deleted);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nonDeletedSessions));
      
      // Update local sessions reference
      localSessions = nonDeletedSessions;
    }
    
    // Convert date strings to Date objects
    const parsedSessions = localSessions.map((session: any) => ({
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
      syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined,
      lastSyncAttempt: session.lastSyncAttempt ? new Date(session.lastSyncAttempt) : undefined,
      // Set all sessions to synced in local-only mode
      syncStatus: 'synced' as SyncStatus
    }));
    
    // Save parsed sessions back to storage
    await AsyncStorage.setItem(storageKey, JSON.stringify(parsedSessions));
    
    // Update last sync timestamp
    const lastSyncKey = getLastSyncKey(userId);
    await AsyncStorage.setItem(lastSyncKey, new Date().toISOString());
    
    console.log(`[Local] Successfully processed ${parsedSessions.length} local sessions`);
  } catch (error: any) {
    console.error('Failed to process local sessions:', error);
  }
}

/**
 * Setup event handler for local changes
 */
export function setupRealtimeSync(userId: string, onSessionsUpdate: (sessions: TimeSession[]) => void) {
  if (!userId) return () => {};
  
  // In a local-only app, we don't have realtime updates
  // This is a no-op function that returns an empty cleanup function
  
  // To avoid breaking existing code, we'll immediately read the sessions
  // and call the callback once
  const loadLocalSessions = async () => {
    try {
      const storageKey = getStorageKey(userId);
      const storedSessions = await AsyncStorage.getItem(storageKey);
      let localSessions: TimeSession[] = storedSessions 
        ? JSON.parse(storedSessions) 
        : [];
      
      // Convert date strings to Date objects
      const parsedSessions = localSessions.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined,
        updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
        syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined,
        lastSyncAttempt: session.lastSyncAttempt ? new Date(session.lastSyncAttempt) : undefined
      }));
      
      // Call the callback with the sessions
      onSessionsUpdate(parsedSessions);
    } catch (error) {
      console.error('Error loading local sessions:', error);
    }
  };
  
  // Load sessions once
  InteractionManager.runAfterInteractions(() => {
    loadLocalSessions();
  });
  
  // Return empty cleanup function
  return () => {};
} 