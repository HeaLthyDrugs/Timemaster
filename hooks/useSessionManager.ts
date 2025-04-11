import { useState, useEffect, useCallback } from 'react';
import { TimeSession } from '~/types/timeSession';
import { useAuth } from '~/contexts/AuthContext';
import { syncSessionsWithFirebase, updateFirebaseSessions } from '~/services/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStorageKey = (userId: string) => `time_sessions_${userId}`;

export const useSessionManager = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load sessions from storage and sync with Firebase
  const loadSessions = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const syncedSessions = await syncSessionsWithFirebase(user.uid);
      if (syncedSessions) {
        setSessions(syncedSessions);
        const active = syncedSessions.find(session => session.isActive);
        if (active) {
          setActiveSession(active);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      try {
        const storedSessions = await AsyncStorage.getItem(getStorageKey(user.uid));
        if (storedSessions) {
          const parsedSessions = JSON.parse(storedSessions) as TimeSession[];
          const sessionsWithDates = parsedSessions.map((session) => ({
            ...session,
            startTime: new Date(session.startTime),
            endTime: session.endTime ? new Date(session.endTime) : undefined
          }));
          setSessions(sessionsWithDates);
          const active = sessionsWithDates.find((session) => session.isActive);
          if (active) {
            setActiveSession(active);
          }
        }
      } catch (localError) {
        console.error('Failed to load local sessions:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Save sessions to both AsyncStorage and Firebase
  const saveSessions = useCallback(async (updatedSessions: TimeSession[]) => {
    if (!user) return;

    try {
      setSessions(updatedSessions);
      await AsyncStorage.setItem(getStorageKey(user.uid), JSON.stringify(updatedSessions));
      if (isOnline) {
        await updateFirebaseSessions(user.uid, updatedSessions);
      }
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }, [user, isOnline]);

  // Start a new session
  const startSession = useCallback(async (sessionData: Omit<TimeSession, 'id' | 'startTime' | 'isActive' | 'saved'>) => {
    if (!user) return;

    const newSession: TimeSession = {
      id: Date.now().toString(),
      ...sessionData,
      startTime: new Date(),
      isActive: true,
      saved: false,
    };

    const updatedSessions = [newSession, ...sessions];
    await saveSessions(updatedSessions);
    setActiveSession(newSession);
  }, [sessions, saveSessions, user]);

  // Stop the active session
  const stopSession = useCallback(async () => {
    if (!activeSession) return;

    const now = new Date();
    const updatedSessions = sessions.map(session => {
      if (session.id === activeSession.id) {
        // Calculate elapsed time from this session run only
        const currentRunTime = now.getTime() - session.startTime.getTime();
        // Add to any previous elapsed time
        const totalElapsedTime = (session.elapsedTime || 0) + currentRunTime;
        
        return { 
          ...session, 
          endTime: now, 
          isActive: false,
          elapsedTime: totalElapsedTime
        };
      }
      return session;
    });

    await saveSessions(updatedSessions);
    setActiveSession(null);
  }, [activeSession, sessions, saveSessions]);

  // Resume a saved session
  const resumeSession = useCallback(async (sessionId: string) => {
    const sessionToResume = sessions.find(s => s.id === sessionId);
    if (!sessionToResume) return;

    // If there's an active session, stop it first
    if (activeSession) {
      await stopSession();
    }

    const updatedSessions = sessions.map(session => {
      if (session.id === sessionId) {
        // Get the previously accumulated elapsed time, or 0 if none
        const previousElapsedTime = session.elapsedTime || 0;
        
        return { 
          ...session, 
          isActive: true, 
          saved: false, 
          elapsedTime: previousElapsedTime,
          startTime: new Date(), // Current time when resuming
          endTime: undefined // Clear end time when resuming
        };
      }
      return session;
    });

    await saveSessions(updatedSessions);
    setActiveSession(updatedSessions.find(s => s.id === sessionId) || null);
  }, [sessions, activeSession, stopSession, saveSessions]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    const updatedSessions = sessions.filter(session => session.id !== sessionId);
    await saveSessions(updatedSessions);
    
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
    }
  }, [sessions, activeSession, saveSessions]);

  // Update a session or add a new one
  const updateSession = useCallback(async (updatedSession: TimeSession) => {
    // Check if the session already exists
    const existingSessionIndex = sessions.findIndex(session => session.id === updatedSession.id);
    
    let updatedSessions: TimeSession[];
    
    if (existingSessionIndex !== -1) {
      // Update existing session
      updatedSessions = [...sessions];
      updatedSessions[existingSessionIndex] = updatedSession;
    } else {
      // Add new session to the beginning of the list
      updatedSessions = [updatedSession, ...sessions];
    }
    
    await saveSessions(updatedSessions);
    
    if (activeSession?.id === updatedSession.id) {
      setActiveSession(updatedSession);
    }
  }, [sessions, activeSession, saveSessions]);

  // Load sessions on mount and when user changes
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Set up periodic sync
  useEffect(() => {
    if (!user || isSyncing) return;

    const syncData = async () => {
      try {
        setIsSyncing(true);
        if (!isOnline) return;
        
        const syncedSessions = await syncSessionsWithFirebase(user.uid);
        if (syncedSessions) {
          setSessions(syncedSessions);
          const active = syncedSessions.find(session => session.isActive);
          if (active) {
            setActiveSession(active);
          }
        }
      } catch (error: any) {
        console.error('Sync error:', error);
        if (error.code === 'firestore/permission-denied') {
          setIsOnline(false);
        }
      } finally {
        setIsSyncing(false);
      }
    };

    // Initial sync
    syncData();

    // Set up periodic sync (every 5 minutes)
    const syncInterval = setInterval(() => {
      if (isOnline && !isSyncing) {
        syncData();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [user, isOnline, isSyncing]);

  return {
    sessions,
    activeSession,
    isLoading,
    startSession,
    stopSession,
    resumeSession,
    deleteSession,
    updateSession,
  };
}; 