import { TimeSession, SyncStatus } from '~/types/timeSession';
import { db } from '~/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import syncUtils from './sync-utils';
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { InteractionManager } from 'react-native';
import { isReleaseEnvironment } from '~/config/firebase';

// Collections
const SESSIONS_COLLECTION = 'sessions';
const SYNC_LOG_COLLECTION = 'sync_logs';

// Storage keys
const getStorageKey = (userId: string) => `time_sessions_${userId}`;
const getSyncConfigKey = (userId: string) => `sync_config_${userId}`;
const getLastSyncKey = (userId: string) => `last_sync_${userId}`;

// Batch size for Firestore operations
const BATCH_SIZE = 20;

// Sync intervals
const ACTIVE_SESSION_SYNC_INTERVAL = 30000; // 30 seconds for active sessions
const BACKGROUND_SYNC_INTERVAL = 60000; // 1 minute for background sync

// Retry config
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000; // Start with 1 second

// Destructure the utility functions
const { throttle, retry } = syncUtils;

// Throttled functions
const throttledSyncActiveSession = throttle(syncActiveSession, ACTIVE_SESSION_SYNC_INTERVAL);

/**
 * Initialize sync listeners for app state and network changes
 */
export function initSyncListeners(userId: string, onSyncComplete?: () => void) {
  if (!userId) return null;

  // Listen for app state changes (foreground/background)
  const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground
      syncAllPendingSessions(userId).catch(console.error);
    }
  });

  // Listen for network connectivity changes
  const netInfoUnsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      // Network is available, sync pending sessions
      syncAllPendingSessions(userId)
        .then(() => onSyncComplete?.())
        .catch(console.error);
    }
  });

  // Return cleanup function
  return () => {
    appStateSubscription.remove();
    netInfoUnsubscribe();
  };
}

/**
 * Mark a session for sync with pending status
 */
export async function markForSync(session: TimeSession): Promise<TimeSession> {
  if (!session.userId) {
    console.warn('Session has no userId, cannot mark for sync', session);
    return session;
  }

  const now = new Date();
  const updatedSession: TimeSession = {
    ...session,
    syncStatus: 'pending',
    updatedAt: now,
    lastSyncAttempt: undefined,
    syncRetryCount: 0
  };

  // Save to local storage
  await updateLocalSession(updatedSession);
  
  return updatedSession;
}

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
 * Sync a single active session with throttling
 */
export function syncActiveSessionThrottled(session: TimeSession): Promise<void> {
  if (!session || !session.isActive || !session.userId) return Promise.resolve();
  
  return throttledSyncActiveSession(session);
}

/**
 * Sync an active session to Firestore
 */
async function syncActiveSession(session: TimeSession): Promise<void> {
  if (!session || !session.isActive || !session.userId) return;
  
  try {
    // Mark as syncing
    const syncingSession: TimeSession = {
      ...session,
      syncStatus: 'syncing' as SyncStatus,
      updatedAt: new Date(),
      lastSyncAttempt: new Date()
    };
    
    await updateLocalSession(syncingSession);
    
    // Get the Firestore document reference - use the proper collection path
    const sessionRef = db.collection('users').doc(session.userId)
      .collection('sessions').doc(session.firebaseId || session.id);
    
    // Convert dates for Firestore
    const firestoreSession = prepareSessionForFirestore(syncingSession);
    
    // Use setDoc with merge to ensure we don't overwrite other fields
    await sessionRef.set(firestoreSession, { merge: true });
    
    // Update local session with synced status
    const syncedSession: TimeSession = {
      ...syncingSession,
      syncStatus: 'synced' as SyncStatus,
      syncedAt: new Date(),
      firebaseId: sessionRef.id // Ensure we capture the Firebase ID
    };
    
    await updateLocalSession(syncedSession);
    
    // Log sync success
    logSync(session.userId, 'success', 'Active session synced', sessionRef.id);
    
    console.log(`[Sync] Active session ${session.id} synced to Firestore`);
  } catch (error) {
    console.error('Failed to sync active session:', error);
    
    // Mark as failed
    const failedSession: TimeSession = {
      ...session,
      syncStatus: 'failed' as SyncStatus,
      lastSyncAttempt: new Date(),
      syncRetryCount: (session.syncRetryCount || 0) + 1
    };
    
    await updateLocalSession(failedSession);
    
    // Log sync failure
    console.error(`[Sync Error] Active session sync failed: ${error}`);
  }
}

/**
 * Sync all pending sessions to Firestore without blocking UI
 */
export async function syncAllPendingSessions(userId: string): Promise<void> {
  if (!userId) return;
  
  try {
    // Check network connectivity first
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('No network connection, skipping sync');
      return;
    }
    
    // Load all sessions from AsyncStorage
    const storageKey = getStorageKey(userId);
    const storedSessions = await AsyncStorage.getItem(storageKey);
    
    if (!storedSessions) {
      console.log('No sessions found for sync');
      return;
    }
    
    const sessions: TimeSession[] = JSON.parse(storedSessions);
    
    // Filter sessions that need syncing
    // Include: 'pending', 'failed', and active sessions
    const pendingSessions = sessions.filter(session => 
      session.syncStatus === 'pending' || 
      session.syncStatus === 'failed' ||
      (session.isActive && (!session.syncedAt || 
        (session.updatedAt && 
         session.syncedAt < session.updatedAt)
      ))
    );
    
    if (pendingSessions.length === 0) {
      console.log('No pending sessions to sync');
      return;
    }
    
    console.log(`Found ${pendingSessions.length} sessions to sync to Firestore`);
    
    // Process in smaller batches using a non-blocking approach
    const batchSize = Math.min(BATCH_SIZE, pendingSessions.length);
    const totalBatches = Math.ceil(pendingSessions.length / batchSize);
    
    // If there's only one small batch, process it directly
    if (totalBatches === 1 && pendingSessions.length <= 5) {
      await syncBatch(pendingSessions, userId);
    } else {
      // For larger datasets, use a staged approach with interleaved requestAnimationFrame
      // to avoid blocking the UI thread
      for (let i = 0; i < pendingSessions.length; i += batchSize) {
        const batch = pendingSessions.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        // Log progress
        console.log(`[Sync] Processing batch ${batchNumber}/${totalBatches}`);
        
        // Use InteractionManager to yield to UI thread between batches
        await new Promise(resolve => {
          // Allow UI to breathe between batches
          if (Platform.OS === 'web') {
            // Use requestAnimationFrame on web
            requestAnimationFrame(() => {
              syncBatch(batch, userId)
                .then(resolve)
                .catch(error => {
                  console.error(`[Sync] Error in batch ${batchNumber}:`, error);
                  resolve(null); // Continue to next batch even if this one fails
                });
            });
          } else {
            // Use InteractionManager on native platforms
            InteractionManager.runAfterInteractions(() => {
              syncBatch(batch, userId)
                .then(resolve)
                .catch(error => {
                  console.error(`[Sync] Error in batch ${batchNumber}:`, error);
                  resolve(null); // Continue to next batch even if this one fails
                });
            });
          }
        });
        
        // Small delay between batches to prevent overwhelming the server
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Update last sync timestamp
    await AsyncStorage.setItem(getLastSyncKey(userId), new Date().toISOString());
    
    console.log('[Sync] All batches completed successfully');
  } catch (error) {
    console.error('Failed to sync pending sessions:', error);
  }
}

/**
 * Sync a batch of sessions to Firestore
 */
async function syncBatch(sessions: TimeSession[], userId: string): Promise<void> {
  if (!sessions.length || !userId) return;
  
  // Process in smaller batches to avoid Firestore limits
  for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
    const batch = sessions.slice(i, i + BATCH_SIZE);
    const writeBatch = db.batch();
    
    for (const session of batch) {
      try {
        // Mark session as syncing
        const syncingSession: TimeSession = {
          ...session,
          syncStatus: 'syncing' as SyncStatus,
          lastSyncAttempt: new Date()
        };
        await updateLocalSession(syncingSession);
        
        // Get document reference - use the proper collection path
        const sessionRef = db.collection('users').doc(userId)
          .collection('sessions').doc(session.firebaseId || session.id);
        
        // Prepare data for Firestore
        const firestoreSession = prepareSessionForFirestore(syncingSession);
        
        // Add to batch
        writeBatch.set(sessionRef, firestoreSession, { merge: true });
        
        console.log(`[Sync] Added session ${session.id} to batch`);
      } catch (error) {
        console.error(`[Sync] Error preparing session ${session.id} for batch:`, error);
      }
    }
    
    try {
      // Commit the batch
      await writeBatch.commit();
      console.log(`[Sync] Batch of ${batch.length} sessions committed to Firestore`);
      
      // Update local status for successfully synced sessions
      for (const session of batch) {
        const syncedSession: TimeSession = {
          ...session,
          syncStatus: 'synced' as SyncStatus,
          syncedAt: new Date(),
          firebaseId: session.firebaseId || session.id
        };
        await updateLocalSession(syncedSession);
      }
    } catch (error) {
      console.error('[Sync] Batch commit failed:', error);
      
      // Mark all sessions in batch as failed
      for (const session of batch) {
        const failedSession: TimeSession = {
          ...session,
          syncStatus: 'failed' as SyncStatus,
          lastSyncAttempt: new Date(),
          syncRetryCount: (session.syncRetryCount || 0) + 1
        };
        await updateLocalSession(failedSession);
      }
    }
  }
}

/**
 * Handle session conflicts based on updatedAt timestamps
 */
async function handleConflict(localSession: TimeSession, remoteSession: any): Promise<TimeSession> {
  // Convert remote session dates from Firestore
  const parsedRemoteSession = parseSessionFromFirestore(remoteSession);
  
  // Default to keeping the local session if no timestamps available
  if (!localSession.updatedAt && !parsedRemoteSession.updatedAt) {
    return { ...localSession, syncStatus: 'conflicted' as SyncStatus };
  }
  
  // If only one has updatedAt, prefer that one
  if (!localSession.updatedAt) return parsedRemoteSession;
  if (!parsedRemoteSession.updatedAt) {
    return {
      ...localSession,
      syncStatus: 'pending' as SyncStatus, // Re-mark for sync
      firebaseId: parsedRemoteSession.id
    };
  }
  
  // Compare timestamps and keep the newer version
  if (localSession.updatedAt > parsedRemoteSession.updatedAt) {
    // Local version is newer, mark for re-sync
    return {
      ...localSession,
      syncStatus: 'pending' as SyncStatus,
      firebaseId: parsedRemoteSession.id
    };
  } else {
    // Remote version is newer, update local
    return {
      ...parsedRemoteSession,
      syncStatus: 'synced' as SyncStatus,
      syncedAt: new Date()
    };
  }
}

/**
 * Pull remote sessions from Firestore and merge with local
 */
export async function pullRemoteSessions(userId: string): Promise<void> {
  if (!userId) return;
  
  try {
    console.log(`[Sync] Pulling remote sessions for user ${userId} in ${isReleaseEnvironment ? 'RELEASE' : 'DEVELOPMENT'} environment`);
    
    // Check network connectivity first
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('No network connection, skipping remote pull');
      return;
    }
    
    // Force a small delay to ensure Firebase connection is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get local sessions first
    const storageKey = getStorageKey(userId);
    const storedSessions = await AsyncStorage.getItem(storageKey);
    const localSessions: TimeSession[] = storedSessions ? JSON.parse(storedSessions) : [];
    
    console.log(`[Sync] Found ${localSessions.length} local sessions`);
    
    // Map local sessions by ID for quick lookup
    const localSessionsMap = new Map<string, TimeSession>();
    localSessions.forEach(session => {
      localSessionsMap.set(session.id, session);
      // Also map by firebaseId if it exists and is different from id
      if (session.firebaseId && session.firebaseId !== session.id) {
        localSessionsMap.set(session.firebaseId, session);
      }
    });
    
    // Get the user's sessions from Firestore
    // Use a large limit to ensure we get all sessions
    const sessionsCollection = db.collection('users').doc(userId).collection('sessions');
    const snapshot = await sessionsCollection.limit(500).get();
    
    if (snapshot.empty) {
      console.log(`[Sync] No remote sessions found for user ${userId}`);
      
      // If there are local sessions but no remote sessions, push local sessions to remote
      if (localSessions.length > 0) {
        console.log(`[Sync] Pushing ${localSessions.length} local sessions to remote`);
        // Call syncAllPendingSessions but don't await its completion to avoid type error
        syncAllPendingSessions(userId).catch(err => 
          console.error('[Sync] Error pushing local sessions to remote:', err)
        );
      }
      
      return;
    }
    
    console.log(`[Sync] Found ${snapshot.docs.length} remote sessions`);
    
    // Track which sessions we've processed
    const processedIds = new Set<string>();
    
    // Process remote sessions and merge with local
    const mergedSessions: TimeSession[] = [];
    
    for (const doc of snapshot.docs) {
      const remoteSession = doc.data();
      processedIds.add(doc.id);
      
      // Convert remote session dates from Firestore
      const parsedRemoteSession = parseSessionFromFirestore(remoteSession);
      
      // Check if we have this session locally
      const localSession = localSessionsMap.get(doc.id) || 
                           (parsedRemoteSession.firebaseId ? 
                            localSessionsMap.get(parsedRemoteSession.firebaseId) : 
                            undefined);
      
      if (localSession) {
        // We have this session locally, resolve any conflicts
        const resolvedSession = await handleConflict(localSession, parsedRemoteSession);
        mergedSessions.push(resolvedSession);
      } else {
        // This is a new session from the remote, add it
        mergedSessions.push({
          ...parsedRemoteSession,
          syncStatus: 'synced',
          syncedAt: new Date()
        });
      }
    }
    
    // Add any local sessions that weren't in the remote set
    for (const localSession of localSessions) {
      if (!processedIds.has(localSession.id) && 
          (!localSession.firebaseId || !processedIds.has(localSession.firebaseId))) {
        
        // If this local session hasn't been synced, mark it for sync
        if (localSession.syncStatus !== 'synced') {
          mergedSessions.push({
            ...localSession,
            syncStatus: 'pending'
          });
        } else {
          mergedSessions.push(localSession);
        }
      }
    }
    
    // Save merged sessions to local storage
    console.log(`[Sync] Saving ${mergedSessions.length} merged sessions to local storage`);
    await AsyncStorage.setItem(storageKey, JSON.stringify(mergedSessions));
    
    // Update last sync timestamp
    const lastSyncKey = getLastSyncKey(userId);
    await AsyncStorage.setItem(lastSyncKey, new Date().toISOString());
    
    // Log sync success
    console.log(`[Sync] Successfully pulled and merged remote sessions`);
    logSync(userId, 'success', `Pulled ${snapshot.docs.length} remote sessions, merged to ${mergedSessions.length} total`);
    
  } catch (error: any) {
    console.error('Failed to pull remote sessions:', error);
    logSync(userId, 'error', `Failed to pull remote sessions: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Set up realtime sync from Firestore
 */
export function setupRealtimeSync(userId: string, onSessionsUpdate: (sessions: TimeSession[]) => void) {
  if (!userId) return () => {};
  
  // Subscribe to sessions collection - use the proper collection path
  const unsubscribe = db.collection('users').doc(userId)
    .collection('sessions')
    .where('userId', '==', userId)
    .onSnapshot(
      async (snapshot) => {
        if (snapshot.empty) return;
        
        // Convert Firestore documents to TimeSession objects
        const remoteSessions: TimeSession[] = [];
        snapshot.forEach(doc => {
          const session = parseSessionFromFirestore({
            ...doc.data(),
            id: doc.id,
            firebaseId: doc.id
          });
          remoteSessions.push(session);
        });
        
        // Get local sessions
        const storageKey = getStorageKey(userId);
        const storedSessions = await AsyncStorage.getItem(storageKey);
        let localSessions: TimeSession[] = storedSessions 
          ? JSON.parse(storedSessions) 
          : [];
        
        // Convert date strings to Date objects in local sessions
        localSessions = localSessions.map(session => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
          syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined,
          lastSyncAttempt: session.lastSyncAttempt ? new Date(session.lastSyncAttempt) : undefined
        }));
        
        // Perform the sync logic
        // ... existing code ...
        
        // Call the callback with updated sessions
        onSessionsUpdate(remoteSessions);
      },
      (error) => {
        console.error('[Sync] Realtime sync error:', error);
      }
    );
  
  return unsubscribe;
}

/**
 * Prepare a session object for Firestore by converting Date objects
 */
function prepareSessionForFirestore(session: TimeSession): any {
  const { syncStatus, syncedAt, lastSyncAttempt, ...sessionData } = session;
  
  return {
    ...sessionData,
    startTime: session.startTime,
    endTime: session.endTime || null,
    updatedAt: session.updatedAt || new Date(),
    userId: session.userId,
    // Add server timestamp for sync tracking
    serverSyncedAt: firestore.FieldValue.serverTimestamp()
  };
}

/**
 * Parse a Firestore document into a TimeSession object
 */
function parseSessionFromFirestore(firestoreSession: any): TimeSession {
  // Helper function to safely parse date fields
  const parseDate = (dateField: any): Date | undefined => {
    if (!dateField) return undefined;
    
    // Handle Firestore Timestamp objects
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate();
    }
    
    // Handle date strings
    if (typeof dateField === 'string') {
      return new Date(dateField);
    }
    
    // Handle date objects
    if (dateField instanceof Date) {
      return dateField;
    }
    
    // Handle numeric timestamps
    if (typeof dateField === 'number') {
      return new Date(dateField);
    }
    
    return undefined;
  };
  
  return {
    id: firestoreSession.id || String(Date.now()),
    category: firestoreSession.category || '',
    subCategory: firestoreSession.subCategory || '',
    title: firestoreSession.title || '',
    startTime: parseDate(firestoreSession.startTime) || new Date(),
    endTime: parseDate(firestoreSession.endTime),
    isActive: firestoreSession.isActive || false,
    saved: firestoreSession.saved || false,
    elapsedTime: firestoreSession.elapsedTime,
    userId: firestoreSession.userId,
    firebaseId: firestoreSession.firebaseId || firestoreSession.id,
    syncStatus: firestoreSession.syncStatus || 'synced',
    syncedAt: parseDate(firestoreSession.syncedAt),
    updatedAt: parseDate(firestoreSession.updatedAt) || new Date(),
    lastSyncAttempt: parseDate(firestoreSession.lastSyncAttempt),
    syncRetryCount: firestoreSession.syncRetryCount || 0,
    deleted: firestoreSession.deleted || false
  };
}

/**
 * Log sync activity for diagnostics and debugging
 * Only logs to console in development to avoid Firestore permission issues
 */
function logSync(userId: string, level: 'info' | 'success' | 'error', message: string, sessionId?: string): void {
  if (!userId) return;
  
  // Log to console for debugging
  console.log(`[Sync ${level}] ${message}${sessionId ? ` (Session: ${sessionId})` : ''}`);
  
  // In production, you would implement proper Firestore logging with appropriate permissions
  // For now, we'll skip Firestore logging to avoid permission errors
  /*
  try {
    // Add a log document to Firestore
    db.collection(SYNC_LOG_COLLECTION).add({
      userId,
      level,
      message,
      sessionId: sessionId || null, // Ensure we don't pass undefined
      timestamp: firestore.FieldValue.serverTimestamp()
    }).catch(error => {
      console.error('Failed to log sync:', error);
    });
  } catch (error) {
    console.error('Failed to log sync:', error);
  }
  */
} 