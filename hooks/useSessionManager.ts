import { useState, useEffect, useCallback, useRef } from 'react';
import { TimeSession, SyncStatus } from '~/types/timeSession';
import { useAuth } from '~/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  markForSync, 
  syncAllPendingSessions, 
  pullRemoteSessions,
  syncActiveSessionThrottled,
  initSyncListeners, 
  setupRealtimeSync
} from '~/services/firestore-sync';
import { useNetwork } from '~/contexts/NetworkContext';
import { AppState, InteractionManager } from 'react-native';
import { isReleaseEnvironment } from '~/config/firebase';

// Use a user-specific key that's consistent across environments
// This is crucial for syncing data between development and release builds
const getSessionsStorageKey = (userId: string) => `time_sessions_${userId}`;

// Keep a shared backup key to maintain backward compatibility
const LEGACY_SESSIONS_STORAGE_KEY = 'time_sessions';

// Debounce function to prevent multiple calls
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const useSessionManager = () => {
  const { user } = useAuth();
  const { isConnected } = useNetwork();
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Use refs to prevent race conditions
  const sessionsRef = useRef<TimeSession[]>([]);
  const activeSessionRef = useRef<TimeSession | null>(null);
  const isLoadingRef = useRef(true);
  const isSyncingRef = useRef(false);
  const isOperationInProgressRef = useRef(false);
  const initialSyncCompleteRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    sessionsRef.current = sessions;
    activeSessionRef.current = activeSession;
    isLoadingRef.current = isLoading;
    isSyncingRef.current = isSyncing;
  }, [sessions, activeSession, isLoading, isSyncing]);
  
  // Save sessions to storage without triggering state updates
  const saveToStorage = useCallback(async (sessionsToSave: TimeSession[]): Promise<void> => {
    if (!user) {
      console.warn('[SessionManager] No user available for saving sessions');
      return;
    }
    
    try {
      const storageKey = getSessionsStorageKey(user.uid);
      console.log(`[SessionManager] Saving ${sessionsToSave.length} sessions to storage with key ${storageKey}`);
      
      // Ensure all sessions have the user ID
      const sessionsWithUserId = sessionsToSave.map(session => ({
        ...session,
        userId: user.uid
      }));
      
      // Save to user-specific storage
      await AsyncStorage.setItem(storageKey, JSON.stringify(sessionsWithUserId));
      
      // For backward compatibility, also save to the legacy key
      await AsyncStorage.setItem(LEGACY_SESSIONS_STORAGE_KEY, JSON.stringify(sessionsWithUserId));
      
      console.log(`[SessionManager] Successfully saved ${sessionsToSave.length} sessions`);
    } catch (error) {
      console.error('[SessionManager] Failed to save sessions to storage:', error);
    }
  }, [user]);

  // Load sessions from local storage with enhanced cross-environment support
  const loadSessions = useCallback(async (forceReload = false) => {
    // Prevent concurrent loads
    if (isOperationInProgressRef.current && !forceReload) return;
    
    try {
      isOperationInProgressRef.current = true;
      setIsLoading(true);
      
      if (!user) {
        console.warn('[SessionManager] No user available for loading sessions');
        setSessions([]);
        setActiveSession(null);
        setIsLoading(false);
        return;
      }
      
      const userId = user.uid;
      const userStorageKey = getSessionsStorageKey(userId);
      
      console.log(`[SessionManager] Loading sessions from storage with key ${userStorageKey} in ${isReleaseEnvironment ? 'RELEASE' : 'DEVELOPMENT'} mode`);
      
      // Try to load from user-specific storage first
      let storedSessions = await AsyncStorage.getItem(userStorageKey);
      
      // If no user-specific sessions, try legacy storage
      if (!storedSessions) {
        console.log('[SessionManager] No user-specific sessions found, checking legacy storage');
        storedSessions = await AsyncStorage.getItem(LEGACY_SESSIONS_STORAGE_KEY);
        
        // If found in legacy storage, migrate to user-specific storage
        if (storedSessions) {
          console.log('[SessionManager] Migrating sessions from legacy storage');
          await AsyncStorage.setItem(userStorageKey, storedSessions);
        }
      }
      
      if (storedSessions) {
        let parsedSessions = JSON.parse(storedSessions) as TimeSession[];
        
        // Filter out any sessions that don't belong to this user
        parsedSessions = parsedSessions.filter((session) => 
          !session.userId || session.userId === userId
        );
        
        // Ensure all sessions have the user ID
        parsedSessions = parsedSessions.map((session) => ({
          ...session,
          userId: userId
        }));
        
        const sessionsWithDates = parsedSessions.map((session) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
          syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined,
          lastSyncAttempt: session.lastSyncAttempt ? new Date(session.lastSyncAttempt) : undefined
        }));
        
        // Find active session if any
        const active = sessionsWithDates.find((session) => session.isActive);
        
        // Set state in a single update
        InteractionManager.runAfterInteractions(() => {
          console.log(`[SessionManager] Setting ${sessionsWithDates.length} sessions in state`);
          setSessions(sessionsWithDates);
          
          if (active) {
            console.log('[SessionManager] Found active session:', active.id);
            setActiveSession(active);
          } else {
            setActiveSession(null);
          }
          
          setIsLoading(false);
        });
        
        // Save back with proper user ID in case we did filtering
        saveToStorage(sessionsWithDates);
      } else {
        // No sessions found, set empty array
        InteractionManager.runAfterInteractions(() => {
          console.log('[SessionManager] No sessions found, setting empty state');
          setSessions([]);
          setActiveSession(null);
          setIsLoading(false);
        });
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load sessions:', error);
      setIsLoading(false);
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [user, saveToStorage]);

  // Stop the active session
  const stopSession = useCallback(async () => {
    if (!activeSessionRef.current || isOperationInProgressRef.current) {
      console.log('[SessionManager] No active session to stop or operation in progress');
      return false;
    }
    
    try {
      console.log('[SessionManager] Stopping session:', activeSessionRef.current.id);
      isOperationInProgressRef.current = true;
      
      const now = new Date();
      const activeSessionId = activeSessionRef.current.id;
      
      // Get current sessions and update them
      const currentSessions = [...sessionsRef.current];
      const updatedSessions = currentSessions.map(session => {
        if (session.id === activeSessionId) {
          // Calculate elapsed time from this session run only
          const currentRunTime = now.getTime() - session.startTime.getTime();
          // Add to any previous elapsed time
          const totalElapsedTime = (session.elapsedTime || 0) + currentRunTime;
          
          return { 
            ...session, 
            endTime: now, 
            isActive: false,
            elapsedTime: totalElapsedTime,
            updatedAt: now,
            syncStatus: 'pending' as SyncStatus
          };
        }
        return session;
      });
      
      // Save to storage first
      await saveToStorage(updatedSessions);
      
      // Then update state after a brief delay 
      InteractionManager.runAfterInteractions(() => {
        console.log('[SessionManager] Updating state after stop');
        setSessions(updatedSessions);
        setActiveSession(null);
      });

      // Mark the stopped session for syncing to Firebase
      const stoppedSession = updatedSessions.find(s => s.id === activeSessionId);
      if (stoppedSession && user) {
        markForSync(stoppedSession).catch(console.error);
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to stop session:', error);
      return false;
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [saveToStorage, user]);

  // Start a new session
  const startSession = useCallback(async (sessionData: Omit<TimeSession, 'id' | 'startTime' | 'isActive' | 'saved'>) => {
    if (isOperationInProgressRef.current) {
      console.log('[SessionManager] Operation in progress, cannot start session');
      return false;
    }
    
    try {
      console.log('[SessionManager] Starting new session');
      isOperationInProgressRef.current = true;
      
      // If there's already an active session, stop it first
      if (activeSessionRef.current) {
        console.log('[SessionManager] Stopping active session before starting new one');
        
        const now = new Date();
        const activeSessionId = activeSessionRef.current.id;
        
        // Get current sessions and update them
        const currentSessions = [...sessionsRef.current];
        const sessionsWithStoppedActive = currentSessions.map(session => {
          if (session.id === activeSessionId) {
            const currentRunTime = now.getTime() - session.startTime.getTime();
            const totalElapsedTime = (session.elapsedTime || 0) + currentRunTime;
            
            return { 
              ...session, 
              endTime: now, 
              isActive: false,
              elapsedTime: totalElapsedTime,
              updatedAt: now,
              syncStatus: 'pending' as SyncStatus
            };
          }
          return session;
        });
        
        // Create new session
        const newSession: TimeSession = {
          id: Date.now().toString(),
          ...sessionData,
          startTime: now,
          isActive: true,
          saved: false,
          userId: user?.uid,
          updatedAt: now,
          syncStatus: 'pending' as SyncStatus
        };
        
        // Add new session to the list
        const updatedSessions = [newSession, ...sessionsWithStoppedActive];
        
        // Save to storage first
        await saveToStorage(updatedSessions);
        
        // Then update state after a brief delay
        InteractionManager.runAfterInteractions(() => {
          console.log('[SessionManager] Updating state after start (with previous active)');
          setSessions(updatedSessions);
          setActiveSession(newSession);
        });

        // Mark sessions for syncing to Firebase
        const stoppedSession = sessionsWithStoppedActive.find(s => s.id === activeSessionId);
        if (stoppedSession && user) {
          markForSync(stoppedSession).catch(console.error);
        }
        if (user) {
          markForSync(newSession).catch(console.error);
        }
      } else {
        // No active session, just create a new one
        const now = new Date();
        const newSession: TimeSession = {
          id: Date.now().toString(),
          ...sessionData,
          startTime: now,
          isActive: true,
          saved: false,
          userId: user?.uid,
          updatedAt: now,
          syncStatus: 'pending' as SyncStatus
        };
        
        // Add new session to the list
        const updatedSessions = [newSession, ...sessionsRef.current];
        
        // Save to storage first
        await saveToStorage(updatedSessions);
        
        // Then update state after a brief delay
        InteractionManager.runAfterInteractions(() => {
          console.log('[SessionManager] Updating state after start (no previous active)');
          setSessions(updatedSessions);
          setActiveSession(newSession);
        });

        // Mark for syncing to Firebase
        if (user) {
          markForSync(newSession).catch(console.error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to start session:', error);
      return false;
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [saveToStorage, user]);

  // Resume a saved session
  const resumeSession = useCallback(async (sessionId: string) => {
    if (isOperationInProgressRef.current) {
      console.log('[SessionManager] Operation in progress, cannot resume session');
      return false;
    }
    
    const sessionToResume = sessionsRef.current.find(s => s.id === sessionId);
    if (!sessionToResume) {
      console.log('[SessionManager] Session not found for resuming:', sessionId);
      return false;
    }
    
    try {
      console.log('[SessionManager] Resuming session:', sessionId);
      isOperationInProgressRef.current = true;
      
      // Create a copy of the current sessions
      let updatedSessions = [...sessionsRef.current];
      
      // If there's already an active session, stop it first
      if (activeSessionRef.current) {
        console.log('[SessionManager] Stopping active session before resuming');
        
        const now = new Date();
        const activeSessionId = activeSessionRef.current.id;
        
        updatedSessions = updatedSessions.map(session => {
          if (session.id === activeSessionId) {
            const currentRunTime = now.getTime() - session.startTime.getTime();
            const totalElapsedTime = (session.elapsedTime || 0) + currentRunTime;
            
            return { 
              ...session, 
              endTime: now, 
              isActive: false,
              elapsedTime: totalElapsedTime,
              updatedAt: now,
              syncStatus: 'pending' as SyncStatus
            };
          }
          return session;
        });

        // Mark the stopped session for syncing
        const stoppedSession = updatedSessions.find(s => s.id === activeSessionId);
        if (stoppedSession && user) {
          markForSync(stoppedSession).catch(console.error);
        }
      }
      
      // Now handle the session to resume
      const now = new Date();
      updatedSessions = updatedSessions.map(session => {
        if (session.id === sessionId) {
          // Get the previously accumulated elapsed time, or 0 if none
          const previousElapsedTime = session.elapsedTime || 0;
          
          return { 
            ...session, 
            isActive: true, 
            saved: false, 
            elapsedTime: previousElapsedTime,
            startTime: now, // Current time when resuming
            endTime: undefined, // Clear end time when resuming
            updatedAt: now,
            syncStatus: 'pending' as SyncStatus,
            userId: user?.uid
          };
        }
        return session;
      });
      
      // Find the resumed session to set as active
      const newActiveSession = updatedSessions.find(s => s.id === sessionId) || null;
      
      // Save to storage first
      await saveToStorage(updatedSessions);
      
      // Then update state after a brief delay
      InteractionManager.runAfterInteractions(() => {
        console.log('[SessionManager] Updating state after resume');
        setSessions(updatedSessions);
        setActiveSession(newActiveSession);
      });

      // Mark the resumed session for syncing
      if (newActiveSession && user) {
        markForSync(newActiveSession).catch(console.error);
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to resume session:', error);
      return false;
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [saveToStorage, user]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (isOperationInProgressRef.current) {
      console.log('[SessionManager] Operation in progress, cannot delete session');
      return false;
    }
    
    try {
      console.log('[SessionManager] Deleting session:', sessionId);
      isOperationInProgressRef.current = true;
      
      const sessionToDelete = sessionsRef.current.find(s => s.id === sessionId);
      const updatedSessions = sessionsRef.current.filter(session => session.id !== sessionId);
      
      // Save to storage first
      await saveToStorage(updatedSessions);
      
      // Then update state after a brief delay
      InteractionManager.runAfterInteractions(() => {
        console.log('[SessionManager] Updating state after delete');
        setSessions(updatedSessions);
        
        if (activeSessionRef.current?.id === sessionId) {
          setActiveSession(null);
        }
      });

      // Mark for deletion in Firebase if the session exists there
      if (sessionToDelete && sessionToDelete.firebaseId && user) {
        // If we have a proper deletion API, we can call it here
        // For now, we can mark it with a special status
        const deletedSession = {
          ...sessionToDelete,
          deleted: true,
          syncStatus: 'pending' as SyncStatus,
          updatedAt: new Date()
        };
        markForSync(deletedSession).catch(console.error);
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to delete session:', error);
      return false;
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [saveToStorage, user]);

  // Update a session or add a new one
  const updateSession = useCallback(async (updatedSession: TimeSession) => {
    if (isOperationInProgressRef.current) {
      console.log('[SessionManager] Operation in progress, cannot update session');
      return false;
    }
    
    try {
      console.log('[SessionManager] Updating session:', updatedSession.id);
      isOperationInProgressRef.current = true;
      
      const now = new Date();
      
      // Add userId and updatedAt if not present
      const sessionToUpdate = {
        ...updatedSession,
        updatedAt: now,
        userId: user?.uid,
        syncStatus: updatedSession.syncStatus || ('pending' as SyncStatus)
      };
      
      // Check if the session already exists
      const existingSessionIndex = sessionsRef.current.findIndex(session => session.id === sessionToUpdate.id);
      
      let updatedSessions: TimeSession[];
      
      if (existingSessionIndex !== -1) {
        // Update existing session
        updatedSessions = [...sessionsRef.current];
        updatedSessions[existingSessionIndex] = sessionToUpdate;
      } else {
        // Add new session to the beginning of the list
        updatedSessions = [sessionToUpdate, ...sessionsRef.current];
      }
      
      // Save to storage first
      await saveToStorage(updatedSessions);
      
      // Then update state after a brief delay
      InteractionManager.runAfterInteractions(() => {
        console.log('[SessionManager] Updating state after update');
        setSessions(updatedSessions);
        
        if (activeSessionRef.current?.id === sessionToUpdate.id) {
          setActiveSession(sessionToUpdate);
        }
      });

      // Mark for syncing to Firebase
      if (user) {
        markForSync(sessionToUpdate).catch(console.error);
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to update session:', error);
      return false;
    } finally {
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [saveToStorage, user]);
  
  // Force a sync with the server (for manual sync buttons, etc.)
  const syncWithServer = useCallback(async () => {
    if (!user || !isConnected || isOperationInProgressRef.current || isSyncingRef.current) {
      console.log('[SessionManager] Cannot sync: user missing, no connection, or operation in progress');
      return false;
    }
    
    try {
      console.log(`[SessionManager] Starting manual sync in ${isReleaseEnvironment ? 'RELEASE' : 'DEVELOPMENT'} mode`);
      isOperationInProgressRef.current = true;
      setIsSyncing(true);
      
      // Use InteractionManager to prevent UI blocking
      await new Promise<void>(resolve => {
        InteractionManager.runAfterInteractions(async () => {
          try {
            // Pull remote changes first with aggressive retry for cross-environment sync
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await pullRemoteSessions(user.uid);
                break; // Success, exit retry loop
              } catch (error) {
                console.error(`[SessionManager] Error pulling remote sessions (attempt ${attempt + 1}/3):`, error);
                if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); // Wait before retry
              }
            }
            
            // Then push local changes
            await syncAllPendingSessions(user.uid);
            
            // Reload sessions after sync
            await loadSessions(true);
            resolve();
          } catch (error) {
            console.error('[SessionManager] Error during manual sync:', error);
            resolve();
          }
        });
      });
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to sync with server:', error);
      return false;
    } finally {
      setIsSyncing(false);
      
      // Short delay to prevent immediate state changes
      setTimeout(() => {
        isOperationInProgressRef.current = false;
      }, 500);
    }
  }, [user, isConnected, loadSessions]);

  // Sync when no active session - debounced to prevent multiple calls
  const debouncedSync = useCallback(
    debounce(() => {
      const hasActiveSession = sessionsRef.current.some(s => s.isActive);
      
      if (
        sessionsRef.current.length > 0 && 
        isConnected && 
        user && 
        !hasActiveSession && 
        !isSyncingRef.current && 
        !isOperationInProgressRef.current
      ) {
        console.log('[SessionManager] Auto-syncing sessions (no active tracking)');
        setIsSyncing(true);
        
        syncAllPendingSessions(user.uid)
          .catch(console.error)
          .finally(() => setIsSyncing(false));
      }
    }, 5000),
    [isConnected, user, sessionsRef]
  );

  // Monitor for sync opportunities
  useEffect(() => {
    const hasActiveSession = sessions.some(s => s.isActive);
    
    if (!hasActiveSession && sessions.length > 0) {
      debouncedSync();
    }
  }, [sessions, debouncedSync]);

  // Initial load - only once on mount
  useEffect(() => {
    console.log(`[SessionManager] Initial load in ${isReleaseEnvironment ? 'RELEASE' : 'DEVELOPMENT'} mode`);
    loadSessions();
    
    // If user returns to app, refresh sessions
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && !isOperationInProgressRef.current) {
        console.log('[SessionManager] App returned to foreground, reloading sessions');
        loadSessions();
      }
    });
    
    // Initialize Firebase sync if user is logged in
    let syncCleanup: (() => void) | null = null;
    let realtimeSyncUnsubscribe: (() => void) | null = null;
    
    if (user && user.uid) {
      console.log('[SessionManager] Initializing Firebase sync listeners');
      syncCleanup = initSyncListeners(user.uid, () => {
        // Reload sessions after sync complete
        loadSessions(true);
      });
      
      // Also set up realtime sync
      realtimeSyncUnsubscribe = setupRealtimeSync(user.uid, (remoteSessions) => {
        if (remoteSessions.length > 0) {
          console.log('[SessionManager] Received realtime session updates');
          loadSessions(true);
        }
      });
      
      // Initial sync attempt with aggressive retry for cross-environment sync
      if (isConnected) {
        const performInitialSync = async () => {
          setIsSyncing(true);
          initialSyncCompleteRef.current = false;
          
          try {
            // Extra delay on first sync to ensure Firebase is fully initialized
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Pull with more aggressive retry attempts
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await pullRemoteSessions(user.uid);
                break; // Success, exit retry loop
              } catch (error) {
                console.error(`[SessionManager] Initial sync error (attempt ${attempt + 1}/3):`, error);
                if (attempt < 2) await new Promise(r => setTimeout(r, 1500)); // Longer wait for initial sync
              }
            }
            
            // Push our local changes
            await syncAllPendingSessions(user.uid);
            
            // Final reload after sync
            await loadSessions(true);
            initialSyncCompleteRef.current = true;
          } catch (error) {
            console.error('[SessionManager] Failed initial sync:', error);
          } finally {
            setIsSyncing(false);
          }
        };
        
        performInitialSync();
      }
    }
    
    return () => {
      appStateSubscription.remove();
      if (syncCleanup) syncCleanup();
      if (realtimeSyncUnsubscribe) realtimeSyncUnsubscribe();
    };
  }, [loadSessions, user, isConnected]);

  return {
    sessions,
    activeSession,
    isLoading,
    isSyncing,
    startSession,
    stopSession,
    resumeSession,
    deleteSession,
    updateSession,
    syncWithServer,
  };
}; 