import { useState, useEffect, useCallback, useRef } from 'react';
import { TimeSession, SyncStatus } from '~/types/timeSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetwork } from '~/contexts/NetworkContext';
import { AppState, InteractionManager } from 'react-native';
import { isReleaseEnvironment } from '~/config/firebase';

// Use a simple storage key for all sessions
const SESSIONS_STORAGE_KEY = 'time_sessions';

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
    try {
      console.log(`[SessionManager] Saving ${sessionsToSave.length} sessions to storage`);
      
      // Save to storage
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessionsToSave));
      
      console.log(`[SessionManager] Successfully saved ${sessionsToSave.length} sessions`);
    } catch (error) {
      console.error('[SessionManager] Failed to save sessions to storage:', error);
    }
  }, []);

  // Load sessions from local storage
  const loadSessions = useCallback(async (forceReload = false) => {
    // Prevent concurrent loads
    if (isOperationInProgressRef.current && !forceReload) return;
    
    try {
      isOperationInProgressRef.current = true;
      setIsLoading(true);
      
      console.log(`[SessionManager] Loading sessions from storage in ${isReleaseEnvironment ? 'RELEASE' : 'DEVELOPMENT'} mode`);
      
      // Try to load from storage
      let storedSessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      
      if (storedSessions) {
        let parsedSessions = JSON.parse(storedSessions) as TimeSession[];
        
        const sessionsWithDates = parsedSessions.map((session) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined
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
  }, [saveToStorage]);

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
            syncStatus: 'synced' as SyncStatus
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
  }, [saveToStorage]);

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
              syncStatus: 'synced' as SyncStatus
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
          updatedAt: now,
          syncStatus: 'synced' as SyncStatus
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
      } else {
        // No active session, just create a new one
        const now = new Date();
        const newSession: TimeSession = {
          id: Date.now().toString(),
          ...sessionData,
          startTime: now,
          isActive: true,
          saved: false,
          updatedAt: now,
          syncStatus: 'synced' as SyncStatus
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
  }, [saveToStorage]);

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
              syncStatus: 'synced' as SyncStatus
            };
          }
          return session;
        });
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
            syncStatus: 'synced' as SyncStatus
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
  }, [saveToStorage]);

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
      if (!sessionToDelete) {
        console.log('[SessionManager] Session not found for deletion:', sessionId);
        return false;
      }
      
      // First, immediately remove from active session if needed
      if (activeSessionRef.current?.id === sessionId) {
        setActiveSession(null);
      }
      
      // Filter out the session to delete
      const updatedSessions = sessionsRef.current.filter(session => session.id !== sessionId);
      
      // Save to storage
      await saveToStorage(updatedSessions);
      
      // Update state
      InteractionManager.runAfterInteractions(() => {
        console.log('[SessionManager] Updating state after delete');
        setSessions(updatedSessions);
      });
      
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
  }, [saveToStorage]);

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
      
      // Add updatedAt if not present
      const sessionToUpdate = {
        ...updatedSession,
        updatedAt: now,
        syncStatus: 'synced' as SyncStatus
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
  }, [saveToStorage]);

  // Empty placeholder for sync function in local-only mode
  const syncWithServer = async () => {
    console.log('[SessionManager] Sync is disabled in local-only mode');
    return;
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    
    // Listen for app state changes to reload sessions when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[SessionManager] App came to foreground, reloading sessions');
        loadSessions();
      }
    });
    
    return () => {
      appStateSubscription.remove();
    };
  }, [loadSessions]);

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
    loadSessions,
  };
}; 