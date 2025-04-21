import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionManager } from '~/hooks/useSessionManager';
import { ScreenContent } from '~/components/ScreenContent';
import { TrackingCard } from '~/components/TrackingCard';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeSession } from '~/types/timeSession';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { InteractionManager } from 'react-native';
import Charts from '~/components/charts';

// Constants
const SESSIONS_STORAGE_KEY = 'time_sessions';

const Analysis = () => {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const { sessions, isLoading, loadSessions } = useSessionManager();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isManualSync, setIsManualSync] = useState(false);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const isFocused = useIsFocused();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Categorized durations in milliseconds
  const [categorized, setCategorized] = useState({
    clarity: 0, // Goal category
    lost: 0,    // Unwilling category
    body: 0     // Health category
  });

  // Timer for real-time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Handle manual refresh
  const handleManualSync = useCallback(async () => {
    if (isManualSync) return;
    
    try {
      setIsManualSync(true);
      await loadSessions(true);
      // Update last updated time
      setLastUpdated(new Date());
    } finally {
      setIsManualSync(false);
    }
  }, [isManualSync, loadSessions]);
  
  // Refresh data when the screen comes into focus
  useEffect(() => {
    if (isFocused) {
      loadSessions().then(() => {
        setLastUpdated(new Date());
      });
    }
  }, [isFocused, loadSessions]);
  
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
    // Skip processing if loading or no sessions
    if (isLoading || sessions.length === 0) {
      setCategorized({
        clarity: 0,
        lost: 0,
        body: 0
      });
      return;
    }
    
    try {
      setIsLocalLoading(true);
      
      // Get today's date at midnight for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get tomorrow's date at midnight
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Filter sessions from today only
      const todaySessions = sessions.filter(session => {
        // Skip deleted sessions
        if (session.deleted) return false;
        
        // Make sure we're working with date objects
        const sessionStart = session.startTime instanceof Date 
          ? session.startTime 
          : new Date(session.startTime);
        
        // Use end time if available, otherwise use current time for active sessions
        const sessionEnd = session.endTime
          ? (session.endTime instanceof Date ? session.endTime : new Date(session.endTime))
          : new Date();
        
        // Check if session overlaps with today
        return (sessionStart >= today && sessionStart < tomorrow) || 
               (sessionEnd >= today && sessionEnd < tomorrow) ||
               (sessionStart < today && sessionEnd >= tomorrow);
      });
      
      // Calculate time spent in each category
      let clarityTime = 0;
      let lostTime = 0;
      let bodyTime = 0;
      
      todaySessions.forEach(session => {
        // Make sure we're working with date objects
        const sessionStart = session.startTime instanceof Date 
          ? session.startTime 
          : new Date(session.startTime);
        
        // Use end time if available, otherwise use current time for active sessions
        const sessionEnd = session.endTime
          ? (session.endTime instanceof Date ? session.endTime : new Date(session.endTime))
          : new Date();
        
        // Calculate overlap with today
        const overlapStart = sessionStart < today ? today : sessionStart;
        const overlapEnd = sessionEnd > tomorrow ? tomorrow : sessionEnd;
        
        // Calculate milliseconds elapsed
        let ms = 0;
        
        if (overlapStart < overlapEnd) {
          ms = overlapEnd.getTime() - overlapStart.getTime();
        }
        
        // Categorize the time
        switch (session.category.toLowerCase()) {
          case 'goal':
            clarityTime += ms;
            break;
          case 'lost':
            lostTime += ms;
            break;
          case 'health':
            bodyTime += ms;
            break;
          default:
            // Unknown category, ignore
            break;
        }
      });
      
      setCategorized({
        clarity: clarityTime,
        lost: lostTime,
        body: bodyTime
      });
    } finally {
      setIsLocalLoading(false);
    }
  }, [sessions, currentTime, isLoading]);
  
  // Background color based on color scheme
  const backgroundColor = colorScheme === 'dark' ? 'black' : '#fafaff';
  
  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Analysis',
          headerStyle: {
            backgroundColor,
          }
        }}
      />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with refresh button */}
        <View style={styles.header}>
          <Text style={[
            styles.headerText,
            { color: colorScheme === 'dark' ? 'white' : 'black' }
          ]}>
            Today's Progress
          </Text>
          
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={handleManualSync}
            disabled={isManualSync || isLoading}
          >
            {isManualSync || isLoading ? (
              <ActivityIndicator size="small" color={colorScheme === 'dark' ? 'white' : 'black'} />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colorScheme === 'dark' ? 'white' : 'black'}
              />
            )}
          </TouchableOpacity>
        </View>
        
        {isLocalLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colorScheme === 'dark' ? 'white' : 'black'} />
            <Text style={{ 
              color: colorScheme === 'dark' ? 'white' : 'black',
              marginTop: 10
            }}>
              Loading data...
            </Text>
          </View>
        ) : (
          <>
            {/* Analytics Cards */}
            <View style={styles.cardsContainer}>
              <TrackingCard
                title="Clarity"
                time={formatTime(categorized.clarity)}
                description="Goal-oriented work"
                backgroundColor={colorScheme === 'dark' ? '#1e3a8a' : '#dbeafe'}
                delay={0}
              />
              
              <TrackingCard
                title="Body"
                time={formatTime(categorized.body)}
                description="Health activities"
                backgroundColor={colorScheme === 'dark' ? '#065f46' : '#d1fae5'}
                delay={100}
              />
              
              <TrackingCard
                title="Lost"
                time={formatTime(categorized.lost)}
                description="Time wasted"
                backgroundColor={colorScheme === 'dark' ? '#9d174d' : '#fce7f3'}
                delay={200}
              />
            </View>
            
            {/* Charts */}
            <View style={styles.chartsContainer}>
              <Text style={[
                styles.chartTitle,
                { color: colorScheme === 'dark' ? 'white' : 'black' }
              ]}>
                Time Analysis
              </Text>
              <Charts
                timeData={categorized}
                sessions={sessions.filter(session => !session.deleted)}
              />
            </View>
            
            {/* Last updated indicator */}
            <Text style={styles.lastUpdatedText}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  chartsContainer: {
    marginBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  lastUpdatedText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default Analysis;
