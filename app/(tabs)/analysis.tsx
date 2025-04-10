import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionManager } from '~/hooks/useSessionManager';
import { ScreenContent } from '~/components/ScreenContent';
import { TrackingCard } from '~/components/TrackingCard';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeSession } from '~/types/timeSession';
import { useAuth } from '~/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { pullRemoteSessions, syncAllPendingSessions } from '~/services/firestore-sync';
import { useIsFocused } from '@react-navigation/native';
import { InteractionManager } from 'react-native';

export default function Analysis() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const { user } = useAuth();
  const { sessions, isLoading, syncWithServer, isSyncing } = useSessionManager();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [combinedSessions, setCombinedSessions] = useState<TimeSession[]>([]);
  const [isLocalLoading, setIsLocalLoading] = useState(false); // Don't show initial loading
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isManualSync, setIsManualSync] = useState(false);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const isFocused = useIsFocused();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Categorized durations in milliseconds
  const [categorized, setCategorized] = useState({
    clarity: 0, // Goal category
    mind: 0,    // Unwilling category
    body: 0     // Health category
  });

  // Timer for real-time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Load local sessions without showing loading indicators
  const loadLocalSessions = useCallback(async () => {
    if (!user) return [];
    
    try {
      const storageKey = `time_sessions_${user.uid}`;
      const storedSessions = await AsyncStorage.getItem(storageKey);
      
      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions) as TimeSession[];
        const sessionsWithDates = parsedSessions.map((session) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined,
          syncedAt: session.syncedAt ? new Date(session.syncedAt) : undefined
        }));
        
        // Filter out deleted sessions
        const filteredSessions = sessionsWithDates.filter(session => !session.deleted);
        return filteredSessions;
      }
      return [];
    } catch (error) {
      console.error('Failed to load local sessions:', error);
      return [];
    }
  }, [user]);
  
  // Combine sessions from session manager and local storage
  const updateSessions = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLocalLoading(true);
    }
    
    try {
      const localSessions = await loadLocalSessions();
      
      // Combine sessions, preferring Firebase sessions if available
      if (sessions.length > 0) {
        setCombinedSessions(sessions);
      } else if (localSessions.length > 0) {
        setCombinedSessions(localSessions);
      } else {
        setCombinedSessions([]);
      }
      
      setLastUpdated(new Date());
    } finally {
      if (showLoading) {
        // Delay hiding the loading indicator slightly to prevent flicker
        setTimeout(() => {
          setIsLocalLoading(false);
        }, 300);
      }
    }
  }, [sessions, loadLocalSessions]);
  
  // Sync with Firebase in the background without UI disruption
  const syncWithFirebaseBackground = useCallback(async () => {
    if (!user) return;
    
    try {
      // Show sync indicator only if it takes longer than 500ms
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        setShowSyncIndicator(true);
      }, 500);
      
      // Run sync operations
      await InteractionManager.runAfterInteractions(async () => {
        // First pull remote sessions
        await pullRemoteSessions(user.uid);
        
        // Then sync pending sessions
        await syncAllPendingSessions(user.uid);
        
        // Update the combined sessions without loading indicator
        await updateSessions(false);
      });
    } catch (error) {
      console.error('Failed to sync with Firebase:', error);
    } finally {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      setShowSyncIndicator(false);
    }
  }, [user, updateSessions]);
  
  // Handle manual sync with loading indicator
  const handleManualSync = useCallback(async () => {
    if (!user || isManualSync) return;
    
    try {
      setIsManualSync(true);
      
      if (syncWithServer) {
        await syncWithServer();
      } else {
        await syncWithFirebaseBackground();
      }
      
      // Update sessions after sync
      await updateSessions(false);
    } finally {
      setIsManualSync(false);
    }
  }, [user, isManualSync, syncWithServer, syncWithFirebaseBackground, updateSessions]);
  
  // Initial load and update when sessions change
  useEffect(() => {
    updateSessions(false);
  }, [updateSessions, sessions]);
  
  // Background sync when the screen comes into focus
  useEffect(() => {
    if (isFocused && user) {
      syncWithFirebaseBackground();
    }
  }, [isFocused, user, syncWithFirebaseBackground]);
  
  // Format milliseconds to readable time
  const formatTime = useCallback((ms: number) => {
    if (ms === 0) return "0m";
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }, []);
  
  // Process sessions and categorize them
  useEffect(() => {
    // Don't recalculate if there are no sessions
    if (combinedSessions.length === 0) {
      setCategorized({
        clarity: 0,
        mind: 0,
        body: 0
      });
      return;
    }
    
    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow's date at midnight
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Filter sessions from today only
    const todaySessions = combinedSessions.filter(session => {
      // Make sure we're working with date objects
      const sessionStart = session.startTime instanceof Date 
        ? session.startTime 
        : new Date(session.startTime);
        
      // For active sessions, check if they were active today
      if (session.isActive) {
        return true; // Include all active sessions
      } 
      
      // For sessions with an end time
      if (session.endTime) {
        const sessionEnd = session.endTime instanceof Date
          ? session.endTime
          : new Date(session.endTime);
          
        // Session ended today
        if (sessionEnd >= today && sessionEnd < tomorrow) {
          return true;
        }
        
        // Session started before today but ended after today (spans multiple days)
        if (sessionStart < today && sessionEnd >= tomorrow) {
          return true;
        }
      }
      
      // For saved sessions, check if they were created today
      if (sessionStart >= today && sessionStart < tomorrow) {
        return true;
      }
      
      // Session doesn't match today's criteria
      return false;
    });
    
    // Calculate durations by category
    let goalTime = 0;
    let unwillingTime = 0;
    let healthTime = 0;
    
    todaySessions.forEach(session => {
      // Calculate total elapsed time for each session
      let totalTime = 0;
      
      // Ensure we have proper Date objects
      const startTime = session.startTime instanceof Date 
        ? session.startTime 
        : new Date(session.startTime);
        
      const endTime = session.endTime instanceof Date 
        ? session.endTime 
        : session.endTime ? new Date(session.endTime) : undefined;
      
      if (session.isActive) {
        // Active session: elapsed time + current run time
        const elapsedTime = session.elapsedTime || 0;
        const currentRunTime = currentTime.getTime() - startTime.getTime();
        totalTime = elapsedTime + currentRunTime;
      } else if (session.elapsedTime !== undefined) {
        // Use the correct elapsed time for tracked sessions
        totalTime = session.elapsedTime;
      } else if (endTime) {
        // Fallback for old data format
        const runTime = endTime.getTime() - startTime.getTime();
        totalTime = runTime;
      }
      
      // For sessions that span multiple days, only count the portion that occurred today
      if (!session.isActive && startTime < today && endTime && endTime > today) {
        // Calculate only the portion of time spent today
        const todayStart = new Date(today); // Start of today
        const todayEnd = endTime < tomorrow ? endTime : new Date(tomorrow); // End time or end of today
        
        // Recalculate time only for today's portion
        totalTime = todayEnd.getTime() - todayStart.getTime();
      }
      
      // Categorize based on session category
      switch (session.category) {
        case 'Goal':
          goalTime += totalTime;
          break;
        case 'Unwilling':
          unwillingTime += totalTime;
          break;
        case 'Health':
          healthTime += totalTime;
          break;
      }
    });
    
    setCategorized({
      clarity: goalTime,
      mind: unwillingTime,
      body: healthTime
    });
  }, [combinedSessions, currentTime]);
  
  // Format times for display
  const formattedTimes = useMemo(() => ({
    clarity: formatTime(categorized.clarity),
    mind: formatTime(categorized.mind),
    body: formatTime(categorized.body)
  }), [categorized, formatTime]);
  
  // Pastel colors for the cards
  const cardColors = {
    clarity: colorScheme === 'dark' ? 'rgba(160, 210, 255, 0.15)' : 'rgba(160, 210, 255, 0.3)',
    mind: colorScheme === 'dark' ? 'rgba(255, 191, 200, 0.15)' : 'rgba(255, 191, 200, 0.3)',
    body: colorScheme === 'dark' ? 'rgba(187, 255, 204, 0.15)' : 'rgba(187, 255, 204, 0.3)',
  };
  
  // Format the current date
  const formattedDate = useMemo(() => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);
  
  // Only show loading indicator during initial load
  // We don't want to show loading during background syncs
  const showFullScreenLoading = isLocalLoading && combinedSessions.length === 0;
  
  if (showFullScreenLoading) {
    return (
      <View className='flex-1 justify-center items-center bg-white dark:bg-black'>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text className='mt-4 text-gray-600 dark:text-gray-400'>Loading your time data...</Text>
      </View>
    );
  }
  
  return (
    <>
    <View className='flex-1 p-4 bg-white dark:bg-black'>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm text-gray-400">
          Today's Summary
        </Text>
        <TouchableOpacity 
          onPress={handleManualSync}
          disabled={isManualSync || isSyncing}
          className="flex-row items-center"
        >
          <Text className="text-sm text-gray-400 mr-2">
            {formattedDate}
          </Text>
          {showSyncIndicator || isManualSync || isSyncing ? (
            <ActivityIndicator size="small" color="#6C5CE7" style={{ width: 18, height: 18 }} />
          ) : (
            <Ionicons 
              name="sync" 
              size={18} 
              color="#6C5CE7" 
            />
          )}
        </TouchableOpacity>
      </View>

       {/* Bento Layout for Cards */}
       <View className="flex-row mb-2">
            {/* Clarity Card (Goal) - Takes full width */}
            <TrackingCard
              title="Clarity"
              time={formattedTimes.clarity}
              description="Goal & Focus Work"
              backgroundColor={cardColors.clarity}
              delay={Platform.OS === 'ios' ? 100 : 0}
            />
          </View>
          
          <View className="flex-row">
            {/* Mind Card (Unwilling) */}
            <TrackingCard
              title="Mind"
              time={formattedTimes.mind}
              description="Unwilling & Distractions"
              backgroundColor={cardColors.mind}
              delay={Platform.OS === 'ios' ? 200 : 0}
              className="mr-2"
            />
            
            {/* Body Card (Health) */}
            <TrackingCard
              title="Body"
              time={formattedTimes.body}
              description="Health & Wellness"
              backgroundColor={cardColors.body}
              delay={Platform.OS === 'ios' ? 300 : 0}
            />
          </View>
          
          {/* Empty state when no data for today */}
          {(categorized.clarity === 0 && categorized.mind === 0 && categorized.body === 0) && (
            <View className="mt-8 items-center">
              <Ionicons name="calendar-outline" size={48} color="#6C5CE7" />
              <Text className="text-center mt-4 text-gray-600 dark:text-gray-400">
                No time tracked today yet.
              </Text>
              <Text className="text-center mt-2 text-gray-500 dark:text-gray-500">
                Start tracking your time to see your daily summary.
              </Text>
            </View>
          )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
});
