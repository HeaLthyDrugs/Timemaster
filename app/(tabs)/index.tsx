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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [category, setCategory] = React.useState<string | null>(null);
  const [subCategory, setSubCategory] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [selectedSession, setSelectedSession] = React.useState<TimeSession | null>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [debugMode, setDebugMode] = React.useState(false);
  
  // Animation states
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const sessionItemFadeAnims = React.useRef<{[key: string]: Animated.Value}>({});
  
  // Animation value for highlighting a newly activated session
  const highlightAnim = React.useRef(new Animated.Value(0)).current;
  
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

  const categories = ["Goal", "Health", "Unwilling"];

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
      // Only update if there's an active session
      if (activeSession) {
        requestAnimationFrame(() => {
          setCurrentTime(new Date());
        });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [activeSession]);

  const handleOpenBottomSheet = (session: TimeSession) => {
    // Close any open swipeables first
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
    
    setSelectedSession(session);
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
    if (!session) return "00:00:00";
    
    if (session.isActive) {
      // Active session - show elapsed time plus current running time
      const elapsedMs = session.elapsedTime || 0;
      const currentRunMs = new Date().getTime() - session.startTime.getTime();
      const totalMs = elapsedMs + currentRunMs;
      
      const totalSeconds = Math.floor(totalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else if (session.elapsedTime !== undefined) {
      // Completed or paused session - show just the elapsed time
      const elapsedMs = session.elapsedTime;
      
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Saved but never started session
    return "00:00:00";
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
    const bgColor = session.isActive ? "#FF9500" : "#6C5CE7";
    
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
            <Ionicons name={iconName} size={28} color="white" />
            <Text style={styles.actionText}>{actionText}</Text>
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

  const renderSessionItem = React.useCallback(({ item }: { item: TimeSession }) => {
    // Create animation value for this item if it doesn't exist
    if (!sessionItemFadeAnims.current[item.id]) {
      sessionItemFadeAnims.current[item.id] = new Animated.Value(1);
    }
    
    const itemFadeAnim = sessionItemFadeAnims.current[item.id];
    
    // Calculate the highlight background color for active sessions
    const highlightBackground = item.isActive ? 
      highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(108, 92, 231, 0)', 'rgba(108, 92, 231, 0.15)']
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
          style={[
            item.isActive ? styles.activeSessionCard : styles.sessionCard,
            {
              opacity: itemFadeAnim,
              transform: [{
                scale: itemFadeAnim.interpolate({
                  inputRange: [0.6, 1],
                  outputRange: [0.98, 1]
                })
              }],
              backgroundColor: item.isActive ? highlightBackground : 'white'
            }
          ]}
        >
          <TouchableOpacity 
            onPress={() => {
              handleOpenBottomSheet(item);
              prepareEditSession(item);
            }}
            className={`p-4 rounded-3xl border border-gray-200 dark:border-gray-700 ${
              item.isActive 
                ? 'bg-white dark:bg-gray-800' 
                : 'bg-white dark:bg-gray-800'
            }`}
          >
            {item.isActive ? (
              // Active session UI
              <View className='flex-row items-center'>
                <View className='h-12 w-12 rounded-xl bg-purple-500 justify-center items-center mr-4'>
                  <Ionicons name="desktop-outline" size={20} color="white" />
                </View>
                <View className='flex-1'>
                  <Text className='text-lg font-bold text-gray-800 dark:text-gray-100'>
                    {item.subCategory}
                  </Text>
                  <Text className='text-sm text-gray-500 dark:text-gray-300'>
                    {item.category}
                  </Text>
                </View>
                <View className='items-end'>
                  <Text className='text-xl font-bold text-gray-900 dark:text-gray-100'>
                    {formatTimerDisplay(item)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleStopSession()}
                    className='mt-1'
                  >
                    <Ionicons name="pause" size={24} color="#6C5CE7" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Paused or saved session UI
              <View className='flex-row items-center'>
                <View className='h-12 w-12 rounded-xl bg-purple-500 justify-center items-center mr-4'>
                  <Ionicons name="desktop-outline" size={20} color="white" />
                </View>
                <View className='flex-1'>
                  <Text className='text-sm text-gray-500 dark:text-gray-400'>
                    {item.category}
                  </Text>
                  <Text className='text-base font-medium text-gray-800 dark:text-gray-100'>
                    {item.subCategory}
                  </Text>
                </View>
                <View className='items-end'>
                  <Text className='text-sm text-gray-500 dark:text-gray-400'>
                    {item.saved ? '' : formatTimerDisplay(item)}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => handleResumeSession(item.id)}
                    className='mt-1'
                  >
                    <Ionicons name="play" size={24} color="#6C5CE7" />
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
    highlightAnim
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

  // Display loading state
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-gray-900">
        <Text className="text-gray-800 dark:text-gray-100">Loading sessions...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Animated.View 
          className='flex-1 bg-white dark:bg-gray-900'
          style={{ opacity: fadeAnim }}
        >
          <View className='flex-1 p-4'>
            
            {/* Time Card with Animation */}
            <Animated.View className='mb-4'>
              <TimeCard 
                time={activeSession ? formatTimerDisplay(activeSession) : "00:00:00"} 
                onTimeChange={() => {}} 
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

            {/* Sessions List */}
            <Text className='text-md font-semibold mb-4 text-gray-400 dark:text-gray-100'>Sessions</Text>
            
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
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    backgroundColor: '#FF3B30',
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
    backgroundColor: '#FF3B30',
  },
  resumeButton: {
    backgroundColor: '#6C5CE7',
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 4,
  },
});