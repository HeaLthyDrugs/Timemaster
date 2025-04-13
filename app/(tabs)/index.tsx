import { Stack } from 'expo-router';
import * as React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TimeCard from '~/components/TimeCard';
import { useSessionManager } from '~/hooks/useSessionManager';
import { useRouter } from 'expo-router';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { TimeSession } from '~/types/timeSession';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [category, setCategory] = React.useState<string | null>(null);
  const [subCategory, setSubCategory] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [selectedSession, setSelectedSession] = React.useState<TimeSession | null>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [debugMode, setDebugMode] = React.useState(false);
  // Bottom sheet mode: 'session-edit' or 'timer-view'
  const [bottomSheetMode, setBottomSheetMode] = React.useState<'session-edit' | 'timer-view'>('session-edit');
  
  // Animation states
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const sessionItemFadeAnims = React.useRef<{[key: string]: Animated.Value}>({});
  
  // Animation value for highlighting a newly activated session
  const highlightAnim = React.useRef(new Animated.Value(0)).current;
  
  // Pulsing animation for the timer view
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  // Refs for swipeable items to properly close them
  const swipeableRefs = React.useRef<{ [key: string]: Swipeable | null }>({});

  // FlatList reference for scrolling
  const flatListRef = React.useRef<FlatList>(null);

  const {
    sessions,
    activeSession,
    isLoading,
    startSession: startNewSession,
    stopSession,
    resumeSession,
    deleteSession,
    updateSession,
    syncWithServer,
    isSyncing,
  } = useSessionManager();

  // Bottom sheet references
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ['65%', '75%'], []);

  const categories = ["Goal", "Health", "Lost"];

  // Initialize animation values for each session
  React.useEffect(() => {
    sessions.forEach(session => {
      if (!sessionItemFadeAnims.current[session.id]) {
        sessionItemFadeAnims.current[session.id] = new Animated.Value(1);
      }
    });
  }, [sessions]);

  // Update timer every second with optimized performance
  React.useEffect(() => {
    const timer = setInterval(() => {
      // Update if there's an active session or if we're viewing the timer
      if (activeSession || (bottomSheetMode === 'timer-view' && selectedSession?.isActive)) {
        requestAnimationFrame(() => {
          setCurrentTime(new Date());
        });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [activeSession, bottomSheetMode, selectedSession]);

  React.useEffect(() => {
    // Start pulsing animation if we're in timer view and the session is active
    if (bottomSheetMode === 'timer-view' && selectedSession?.isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset animation when not in timer view
      pulseAnim.setValue(1);
    }
  }, [bottomSheetMode, selectedSession, pulseAnim]);

  const handleOpenBottomSheet = (session: TimeSession) => {
    // Close any open swipeables first
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
    
    setSelectedSession(session);
    setBottomSheetMode('session-edit');
    
    // Set form values for editing
    setCategory(session.category);
    setSubCategory(session.subCategory);
    setTitle(session.title);
    
    bottomSheetModalRef.current?.present();
  };

  const handleOpenTimerView = () => {
    if (!activeSession) return;
    
    setSelectedSession(activeSession);
    setBottomSheetMode('timer-view');
    bottomSheetModalRef.current?.present();
  };

  const handleCloseBottomSheet = () => {
    bottomSheetModalRef.current?.dismiss();
    setSelectedSession(null);
  };

  // Custom backdrop component for bottom sheet
  const renderBackdrop = React.useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const handleStartSession = async () => {
    if (!category || subCategory.trim() === '' || title.trim() === '') {
      return;
    }
    
    // Reset highlight animation for new session
    highlightAnim.setValue(0);
    
    // Create the session immediately
    await startNewSession({
      category,
      subCategory,
      title,
    });
    
    resetForm();
    setCreateModalVisible(false);
    
    // Scroll to top with animation when the new session appears
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ 
        offset: 0,
        animated: true 
      });
    }
    
    // Start highlight animation sequence after scroll completes
    setTimeout(() => {
      Animated.sequence([
        // Pulse highlight effect
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        // Fade out highlight
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }, 300);
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    
    const sessionId = activeSession.id;
    
    // Stop session immediately
    await stopSession();
    
    // Close any open swipeables
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
  };

  const handleResumeSession = async (sessionId: string) => {
    const sessionToResume = sessions.find(s => s.id === sessionId);
    if (!sessionToResume) return;
    
    // Reset highlight animation value
    highlightAnim.setValue(0);
    
    // Resume session immediately
    await resumeSession(sessionId);
    
    // Find the index of this session (it should be at the top after resuming)
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    // Scroll to top to show the now-active session
    if (flatListRef.current && sessionIndex >= 0) {
      flatListRef.current.scrollToOffset({ 
        offset: 0,
        animated: true 
      });
    }
    
    // Create highlight animation
    setTimeout(() => {
      Animated.sequence([
        // Highlight effect
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false, // We need to animate backgroundColor
        }),
        // Fade out the highlight
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }, 300);
    
    // Close any open swipeables
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
  };

  const handleDeleteSession = async (sessionId: string) => {
    // Delete without animation delay
    await deleteSession(sessionId);
    
    // Close any open swipeables
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
  };

  const saveWithoutStarting = async () => {
    if (!category || subCategory.trim() === '' || title.trim() === '') {
      return;
    }

    // Create a new session with saved flag set to true
    const newSession: TimeSession = {
      id: Date.now().toString(),
      category: category,
      subCategory: subCategory,
      title: title,
      startTime: new Date(),
      isActive: false,
      saved: true,
      elapsedTime: 0, // Initialize with zero elapsed time
    };

    // Add the session to the list immediately
    await updateSession(newSession);
    
    resetForm();
    setCreateModalVisible(false);
  };

  const handleUpdateSession = React.useCallback(async () => {
    if (selectedSession) {
      const updatedSession: TimeSession = {
        ...selectedSession,
        category: category || selectedSession.category,
        subCategory: subCategory || selectedSession.subCategory,
        title: title || selectedSession.title,
      };
      await updateSession(updatedSession);
      resetForm();
      handleCloseBottomSheet();
    }
  }, [selectedSession, category, subCategory, title, updateSession]);

  const resetForm = () => {
    setCategory(null);
    setSubCategory('');
    setTitle('');
  };

  const prepareEditSession = (session: TimeSession) => {
    setCategory(session.category);
    setSubCategory(session.subCategory);
    setTitle(session.title);
  };

  const formatDuration = (startTime: Date, endTime?: Date, elapsedTime?: number) => {
    let diffMs: number;
    
    if (elapsedTime) {
      // If we have elapsed time, use that as the base
      diffMs = elapsedTime;
      
      // If the session is active, add the current run time
      if (endTime === undefined) {
        diffMs += new Date().getTime() - startTime.getTime();
      }
    } else {
      // Fall back to simple duration calculation
      const end = endTime || new Date();
      diffMs = end.getTime() - startTime.getTime();
    }
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimerDisplay = (session: TimeSession) => {
    if (!session) return "0s";
    
    if (session.isActive) {
      // Active session - show elapsed time plus current running time
      const elapsedMs = session.elapsedTime || 0;
      const currentRunMs = new Date().getTime() - session.startTime.getTime();
      const totalMs = elapsedMs + currentRunMs;
      
      const totalSeconds = Math.floor(totalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Build the time string with only necessary parts
      let formattedTime = '';
      if (hours > 0) {
        formattedTime += `${hours}h `;
      }
      if (minutes > 0 || hours > 0) {
        formattedTime += `${minutes}m `;
      }
      formattedTime += `${seconds}s`;
      
      return formattedTime;
    } else if (session.elapsedTime !== undefined) {
      // Completed or paused session - show just the elapsed time
      const elapsedMs = session.elapsedTime;
      
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Build the time string with only necessary parts
      let formattedTime = '';
      if (hours > 0) {
        formattedTime += `${hours}h `;
      }
      if (minutes > 0 || hours > 0) {
        formattedTime += `${minutes}m `;
      }
      formattedTime += `${seconds}s`;
      
      return formattedTime;
    }
    
    // Saved but never started session
    return "0s";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render left actions (swipe right to reveal)
  const renderLeftActions = (session: TimeSession, progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 1],
      extrapolate: 'clamp',
    });
    
    const opacity = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [0.8, 1, 1],
      extrapolate: 'clamp',
    });

    // If session is active, show stop button; otherwise show resume button
    const iconName = session.isActive ? "pause" : "play";
    const actionText = session.isActive ? "Stop" : "Resume";
    
    // Get color based on category
    const categoryStyle = getCategoryColor(session.category);
    // Use more pastel-like colors for the action buttons
    const bgColor = session.isActive ? 
      isDark ? 'rgba(255, 149, 0, 0.8)' : 'rgba(255, 149, 0, 0.7)' : 
      categoryStyle.bg;
    
    return (
      <Animated.View style={[
        styles.leftAction, 
        { 
          opacity, 
          transform: [{ translateX: trans }, { scale }], 
          backgroundColor: bgColor 
        }
      ]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (session.isActive) {
              handleStopSession();
            } else {
              handleResumeSession(session.id);
            }
          }}
        >
          <Animated.View>
            <Ionicons name={iconName} size={28} color={categoryStyle.text} />
            <Text style={[styles.actionText, { color: categoryStyle.text }]}>{actionText}</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render right actions (swipe left to reveal)
  const renderRightActions = (session: TimeSession, progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [0, 0, 40],
      extrapolate: 'clamp',
    });
    
    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 1, 0.8],
      extrapolate: 'clamp',
    });
    
    return (
      <Animated.View style={[
        styles.rightAction, 
        { 
          opacity, 
          transform: [{ translateX: trans }, { scale }] 
        }
      ]}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteSession(session.id)}
        >
          <Animated.View>
            <Ionicons name="trash-outline" size={28} color="white" />
            <Text style={styles.actionText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Theme colors based on category
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Goal':
        return {
          bg: isDark ? 'rgba(160, 210, 255, 0.15)' : 'rgba(160, 210, 255, 0.3)',
          text: isDark ? '#A0D2FF' : '#1E3A8A',
          icon: 'brain'
        };
      case 'Lost':
        return {
          bg: isDark ? 'rgba(255, 191, 200, 0.15)' : 'rgba(255, 191, 200, 0.3)',
          text: isDark ? '#FFBFC8' : '#9D174D',
          icon: 'hourglass-half'
        };
      case 'Health':
        return {
          bg: isDark ? 'rgba(187, 255, 204, 0.15)' : 'rgba(187, 255, 204, 0.3)',
          text: isDark ? '#BBFFCC' : '#065F46',
          icon: 'running'
        };
      // Legacy category name support
      case 'Unwilling':
        return {
          bg: isDark ? 'rgba(255, 191, 200, 0.15)' : 'rgba(255, 191, 200, 0.3)',
          text: isDark ? '#FFBFC8' : '#9D174D',
          icon: 'hourglass-half'
        };
      default:
        return {
          bg: isDark ? 'rgba(160, 210, 255, 0.15)' : 'rgba(160, 210, 255, 0.3)',
          text: isDark ? '#A0D2FF' : '#1E3A8A',
          icon: 'clock'
        };
    }
  };

  // Get the card background color for the TimeCard based on active session
  const getTimeCardBackground = () => {
    if (!activeSession) return 'bg-white dark:bg-gray-800';
    
    const { bg } = getCategoryColor(activeSession.category);
    return bg;
  };

  // In renderSessionItem function, replace the card UI
  const renderSessionItem = React.useCallback(({ item }: { item: TimeSession }) => {
    // Create animation value for this item if it doesn't exist
    if (!sessionItemFadeAnims.current[item.id]) {
      sessionItemFadeAnims.current[item.id] = new Animated.Value(1);
    }
    
    const itemFadeAnim = sessionItemFadeAnims.current[item.id];
    
    // Get category styling
    const categoryStyle = getCategoryColor(item.category);
    
    // Calculate the highlight background color for active sessions
    const highlightBackground = item.isActive ? 
      highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(108, 92, 231, 0)', categoryStyle.bg]
      }) : 'transparent';
    
    return (
      <Swipeable
        ref={ref => swipeableRefs.current[item.id] = ref}
        renderLeftActions={(progress, dragX) => renderLeftActions(item, progress, dragX)}
        renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)}
        friction={2}
        leftThreshold={80}
        rightThreshold={80}
        overshootLeft={false}
        overshootRight={false}
      >
        <Animated.View 
        >
          <TouchableOpacity 
            onPress={() => {
              handleOpenBottomSheet(item);
              prepareEditSession(item);
            }}
            className={`p-4 rounded-3xl ${
              item.isActive 
                ? 'bg-white dark:bg-gray-800' 
                : 'bg-white dark:bg-gray-900'
            }`}
          >
            {item.isActive ? (
              // Active session UI
              <View className='flex-row items-center'>
                <View className='h-12 w-12 rounded-xl justify-center items-center mr-4' 
                  style={{ backgroundColor: categoryStyle.bg }}>
                  <FontAwesome5 name={categoryStyle.icon} size={20} color={categoryStyle.text} style={{ opacity: 0.7 }} />
                </View>
                <View className='flex-1'>
                  <Text className='text-lg font-bold text-gray-800 dark:text-gray-100'>
                    {item.subCategory}
                  </Text>
                  <View className='flex-row flex-wrap'>
                    <View 
                      style={{ backgroundColor: categoryStyle.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}
                    >
                      <Text style={{ color: categoryStyle.text, fontSize: 12, fontWeight: '500' }}>
                        {item.title}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className='items-end'>
                  <Text className='text-xl font-bold text-gray-900 dark:text-gray-100'>
                    {formatTimerDisplay(item)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleStopSession()}
                    className='mt-1'
                  >
                    <Ionicons name="pause" size={24} color={categoryStyle.text} style={{ opacity: 0.8 }} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Paused or saved session UI
              <View className='flex-row items-center'>
                <View className='h-12 w-12 rounded-xl justify-center items-center mr-4' 
                  style={{ backgroundColor: categoryStyle.bg }}>
                  <FontAwesome5 name={categoryStyle.icon} size={20} color={categoryStyle.text} style={{ opacity: 0.7 }} />
                </View>
                <View className='flex-1'>
                  <Text className='text-lg font-medium text-gray-500 dark:text-gray-100'>
                    {item.subCategory}
                  </Text>
                  <View className='flex-row flex-wrap'>
                    <View 
                      style={{ backgroundColor: categoryStyle.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}
                    >
                      <Text className='font-medium' style={{ color: categoryStyle.text, fontSize: 12, }}>
                        {item.title}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className='items-end'>
                  <Text className='text-sm text-gray-500 dark:text-gray-400'>
                    {item.saved ? '' : formatTimerDisplay(item)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleResumeSession(item.id)}
                    className='mt-1'
                  >
                    <Ionicons name="play" size={24} color={categoryStyle.text} style={{ opacity: 0.8 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    );
  }, [
    currentTime, 
    formatTimerDisplay, 
    handleOpenBottomSheet, 
    prepareEditSession, 
    renderLeftActions, 
    renderRightActions,
    highlightAnim,
    isDark
  ]);

  // Toggle debug mode with a long press on the app header
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };
  
  // Force a manual sync
  const handleManualSync = async () => {
    if (syncWithServer) {
      try {
        await syncWithServer();
        console.log('Manual sync completed');
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  };

  // Internet status state
  const [isOnline, setIsOnline] = React.useState(true);

  // Check internet connection status
  React.useEffect(() => {
    const handleConnectionChange = (state: any) => {
      setIsOnline(state.isConnected || state.isInternetReachable);
    };

    // Set up initial value and subscribe to network info changes
    const unsubscribe = NetInfo.addEventListener(handleConnectionChange);

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Get status color based on online and sync status
  const getStatusColor = () => {
    if (!isOnline) return '#EF4444'; // Red - offline
    if (isSyncing) return '#F59E0B'; // Amber - syncing
    return '#10B981'; // Green - online and synced
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Animated.View 
          className='flex-1 dark:bg-black'
          style={{ opacity: fadeAnim, backgroundColor: '#fafaff' }}
        >
          <View className='flex-1 px-4'>

          <View className='flex-row justify-between items-center mx-2 my-2'>
            <Text className='text-sm font-semibold text-gray-400 dark:text-gray-100'>
              What are you doing now?
            </Text>
            
            {/* Status indicator */}
            <TouchableOpacity 
              onPress={handleManualSync}
              className='flex-row items-center mr-2'
              disabled={!isOnline || isSyncing}
            >
              <View 
                style={{ 
                  backgroundColor: getStatusColor(),
                  width: 8, 
                  height: 8, 
                  borderRadius: 4
                }} 
              />
              {/* <Text className='text-xs ml-1 text-gray-400 dark:text-gray-500'>
                {!isOnline ? 'Offline' : isSyncing ? 'Syncing...' : 'Online'}
              </Text> */}
            </TouchableOpacity>
          </View>
            
            {/* Time Card with Animation */}
            <Animated.View className='mb-4'>
              <TimeCard 
                time={activeSession ? formatTimerDisplay(activeSession) : "0s"} 
                onTimeChange={() => {}}
                projectName={activeSession?.subCategory || "No active session"}
                onPress={activeSession ? handleOpenTimerView : undefined}
                category={activeSession?.category}
                backgroundColor={activeSession ? getCategoryColor(activeSession.category).bg : 'rgba(108, 92, 231, 0.15)'}
                textColor={activeSession ? getCategoryColor(activeSession.category).text : '#6C5CE7'}
                isActive={!!activeSession}
              />
              
              {/* Debug Controls - Long press the time card to access */}
              <TouchableOpacity 
                onLongPress={toggleDebugMode}
                delayLongPress={1000}
                style={{ position: 'absolute', top: 0, right: 0, width: 40, height: 40 }}
              />
            </Animated.View>
            
            {debugMode && (
              <View className='mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg'>
                <Text className='text-sm font-bold mb-2 text-gray-700 dark:text-gray-300'>Debug Tools</Text>
                <View className='flex-row'>
                  <TouchableOpacity
                    onPress={handleManualSync}
                    className='bg-blue-500 px-3 py-2 rounded-md mr-2'
                  >
                    <Text className='text-white text-xs'>Force Sync</Text>
                  </TouchableOpacity>
                  <Text className='text-xs text-gray-600 dark:text-gray-400 self-center'>
                    {isSyncing ? 'Syncing...' : 'Idle'}
                  </Text>
                </View>
                <Text className='text-xs mt-2 text-gray-500 dark:text-gray-400'>
                  Session count: {sessions.length} • Active: {activeSession ? 'Yes' : 'No'}
                </Text>
              </View>
            )}
            
            {sessions.length === 0 ? (
              <View className='flex-1 justify-center items-center'>
                <Text className='text-gray-500 dark:text-gray-400'>No sessions yet. Tap + to start tracking time.</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={renderSessionItem}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                maxToRenderPerBatch={5}
                windowSize={7}
                removeClippedSubviews={Platform.OS === 'android'}
                updateCellsBatchingPeriod={50}
              />
            )}

            {/* Add Session Floating Button */}
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setCreateModalVisible(true);
              }}
              disabled={!!activeSession}
              className={`absolute bottom-6 self-center w-14 h-14 rounded-full justify-center items-center ${
                activeSession ? 'bg-gray-400' : 'bg-blue-500'
              }`}
            >
              <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
            
            {/* Create Time Tracking Modal */}
            <Modal
              animationType="fade"
              transparent={true}
              visible={createModalVisible}
              onRequestClose={() => setCreateModalVisible(false)}
            >
              <View className='flex-1 justify-center items-center bg-black/40 px-5'>
                <View className='bg-white dark:bg-gray-800 rounded-3xl p-5 w-full max-w-lg'>
                  <Text className='text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100'>What are you up to?</Text>
                  
                  {/* Category Selection */}
                  <View className='flex-row flex-wrap mb-4'>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategory(cat)}
                        className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                          category === cat 
                            ? 'bg-purple-500' 
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <Text 
                          className={`${
                            category === cat 
                              ? 'text-white' 
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Sub-category Input */}
                  <TextInput
                    className='bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-4 text-gray-800 dark:text-gray-100'
                    placeholder="Label this session (e.g. Writing, Gym, Scrolling)"
                    placeholderTextColor="#9ca3af"
                    value={subCategory}
                    onChangeText={setSubCategory}
                  />
                  
                  {/* Title Input */}
                  <TextInput
                    className='bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-6 text-gray-800 dark:text-gray-100'
                    placeholder="Name this activity"
                    placeholderTextColor="#9ca3af"
                    value={title}
                    onChangeText={setTitle}
                  />
                  
                  {/* Action Buttons */}
                  <View className='flex-row justify-between mb-2'>
                    <TouchableOpacity 
                      onPress={handleStartSession}
                      disabled={!category || subCategory.trim() === '' || title.trim() === ''}
                      className={`flex-row items-center justify-center bg-purple-500 rounded-xl py-3 flex-1 mr-2 ${
                        (!category || subCategory.trim() === '' || title.trim() === '')
                          ? 'opacity-50' 
                          : ''
                      }`}
                    >
                      <Ionicons name="play" size={18} color="white" style={{ marginRight: 5 }} />
                      <Text className='text-white font-medium text-center'>
                        Track Now
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={saveWithoutStarting}
                      disabled={!category || subCategory.trim() === '' || title.trim() === ''}
                      className={`flex-row items-center justify-center bg-green-500 rounded-xl py-3 flex-1 mx-2 ${
                        (!category || subCategory.trim() === '' || title.trim() === '')
                          ? 'opacity-50' 
                          : ''
                      }`}
                    >
                      <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 5 }} />
                      <Text className='text-white font-medium text-center'>
                        Save
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => {
                        resetForm();
                        setCreateModalVisible(false);
                      }}
                      className='bg-gray-200 dark:bg-gray-700 rounded-xl py-3 flex-1 ml-2'
                    >
                      <Text className='text-gray-500 dark:text-gray-200 font-medium text-center'>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
          
          {/* Bottom Sheet Modal */}
          <BottomSheetModal
            ref={bottomSheetModalRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: '#9ca3af' }}
          >
            {bottomSheetMode === 'session-edit' && selectedSession && (
              <View className='p-5'>
                <Text className='text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100'>
                  Edit Session
                </Text>
                
                {/* Category Selection */}
                <View className='flex-row flex-wrap mb-4'>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                        category === cat 
                          ? 'bg-purple-500' 
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Text 
                        className={`${
                          category === cat 
                            ? 'text-white' 
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Sub-category Input */}
                <TextInput
                  className='bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-4 text-gray-800 dark:text-gray-100'
                  placeholder="Label this session (e.g. Writing, Gym, Scrolling)"
                  placeholderTextColor="#9ca3af"
                  value={subCategory}
                  onChangeText={setSubCategory}
                />
                
                {/* Title Input */}
                <TextInput
                  className='bg-gray-100 dark:bg-gray-700 p-3 rounded-xl mb-6 text-gray-800 dark:text-gray-100'
                  placeholder="Name this activity"
                  placeholderTextColor="#9ca3af"
                  value={title}
                  onChangeText={setTitle}
                />
                
                {/* Action Buttons */}
                <View className='flex-row justify-between mb-2'>
                  <TouchableOpacity 
                    onPress={handleUpdateSession}
                    disabled={!category || subCategory.trim() === '' || title.trim() === ''}
                    className={`flex-row items-center justify-center bg-green-500 rounded-xl py-3 flex-1 mr-2 ${
                      (!category || subCategory.trim() === '' || title.trim() === '')
                        ? 'opacity-50' 
                        : ''
                    }`}
                  >
                    <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 5 }} />
                    <Text className='text-white font-medium text-center'>
                      Save Changes
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleCloseBottomSheet}
                    className='bg-gray-200 dark:bg-gray-700 rounded-xl py-3 flex-1 ml-2'
                  >
                    <Text className='text-gray-500 dark:text-gray-200 font-medium text-center'>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {bottomSheetMode === 'timer-view' && selectedSession && (
              <View className='p-5 items-center'>
                <Text className='text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100'>
                  Active Session
                </Text>
                
                <Animated.View 
                  className='w-full rounded-2xl p-8 mb-6 items-center'
                  style={[
                    {
                      backgroundColor: getCategoryColor(selectedSession.category).bg
                    },
                    selectedSession.isActive ? {
                      transform: [{ scale: pulseAnim }]
                    } : undefined
                  ]}
                >
                  <Text 
                    className='text-5xl font-bold'
                    style={{ color: getCategoryColor(selectedSession.category).text }}
                  >
                    {formatTimerDisplay(selectedSession)}
                  </Text>
                </Animated.View>
                
                <View className='w-full items-center mb-4'>
                  <Text className='text-xl font-bold text-gray-800 dark:text-gray-100'>
                    {selectedSession.subCategory}
                  </Text>
                  <View className='flex-row mt-2'>
                    <View 
                      style={{ 
                        backgroundColor: getCategoryColor(selectedSession.category).bg, 
                        borderRadius: 12, 
                        paddingHorizontal: 12, 
                        paddingVertical: 4 
                      }}
                    >
                      <Text 
                        style={{ 
                          color: getCategoryColor(selectedSession.category).text, 
                          fontSize: 12, 
                          fontWeight: '500' 
                        }}
                      >
                        {selectedSession.title}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View className='flex-row justify-center w-full mt-4'>
                  <TouchableOpacity 
                    onPress={handleStopSession}
                    className='rounded-full p-5 mr-5'
                    style={{ 
                      backgroundColor: getCategoryColor(selectedSession.category).bg,
                      borderWidth: 1.5,
                      borderColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)'
                    }}
                  >
                    <Ionicons 
                      name="pause" 
                      size={30} 
                      color={getCategoryColor(selectedSession.category).text} 
                      style={{ opacity: 0.8 }}
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleCloseBottomSheet}
                    className='rounded-full p-5'
                    style={{ 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' 
                    }}
                  >
                    <Ionicons 
                      name="close" 
                      size={30} 
                      color={getCategoryColor(selectedSession.category).text} 
                      style={{ opacity: 0.8 }} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </BottomSheetModal>
        </Animated.View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  sessionCard: {
    marginBottom: 3,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  activeSessionCard: {
    marginBottom: 3,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  leftAction: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionButton: {
    width: 100,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  resumeButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.5)',
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 4,
  },
});