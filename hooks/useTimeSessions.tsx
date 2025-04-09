import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeSession } from '../types/timeSession';
import { syncSessionsWithFirebase, updateFirebaseSessions } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from 'react-native';

const STORAGE_KEY = 'time_sessions';

export const useTimeSessions = () => {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load sessions from AsyncStorage
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const storedSessions = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedSessions) {
          setSessions(JSON.parse(storedSessions));
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  // Sync with Firebase when user changes
  useEffect(() => {
    if (user) {
      const syncSessions = async () => {
        try {
          const mergedSessions = await syncSessionsWithFirebase(user.uid);
          if (mergedSessions) {
            setSessions(mergedSessions);
          }
        } catch (error) {
          console.error('Failed to sync with Firebase:', error);
        }
      };

      syncSessions();
    }
  }, [user]);

  // Save sessions to both AsyncStorage and Firebase
  const saveSessions = useCallback(async (updatedSessions: TimeSession[]) => {
    try {
      setSessions(updatedSessions);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      
      // Sync with Firebase if user is logged in
      if (user) {
        await updateFirebaseSessions(user.uid, updatedSessions);
      }
    } catch (error: any) {
      console.error('Failed to save sessions:', error);
      Alert.alert('Error', 'Failed to save sessions: ' + error.message);
    }
  }, [user]);

  // Add a new session
  const addSession = useCallback((session: TimeSession) => {
    saveSessions([...sessions, session]);
  }, [sessions, saveSessions]);

  // Update a session
  const updateSession = useCallback((updatedSession: TimeSession) => {
    const updatedSessions = sessions.map((session) =>
      session.id === updatedSession.id ? updatedSession : session
    );
    saveSessions(updatedSessions);
  }, [sessions, saveSessions]);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    const updatedSessions = sessions.filter((session) => session.id !== sessionId);
    saveSessions(updatedSessions);
  }, [sessions, saveSessions]);

  return {
    sessions,
    loading,
    addSession,
    updateSession,
    deleteSession,
  };
}; 