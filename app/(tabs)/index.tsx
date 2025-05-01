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
  SectionList,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView, Swipeable, RectButton, PanGestureHandler, State } from 'react-native-gesture-handler';
import TimeCard from '~/components/TimeCard';
import { useSessionManager } from '~/hooks/useSessionManager';
import { useRouter } from 'expo-router';
import { TimeSession } from '~/types/timeSession';
import { useColorScheme } from 'nativewind';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActionSheet } from '@expo/react-native-action-sheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Maximum swipe distance (20% of screen width)
const MAX_SWIPE_DISTANCE = SCREEN_WIDTH * 0.2;

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
  
  // Search functionality
  const [searchVisible, setSearchVisible] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  // New state for delete confirmation modal
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);
  
  // Animation states with separate animation values for different properties
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const sessionItemFadeAnims = React.useRef<{[key: string]: Animated.Value}>({});

  // Separate animation values for JS and native drivers
  const animationValues = React.useRef({
    // JS-driven animations (colors, dimensions)
    jsAnimations: {
      highlight: new Animated.Value(0),   // For background color
      timeCardHeight: new Animated.Value(0), // For TimeCard height
      timeCardOpacity: new Animated.Value(0) // For TimeCard opacity
    },
    // Native-driven animations (transforms)
    nativeAnimations: {
      scale: new Animated.Value(1),      // For scaling 
      pulse: new Animated.Value(1)       // For pulsing
    }
  }).current;
  
  // Store translateX values separately from session objects
  const sessionTranslateXValues = React.useRef<{[key: string]: Animated.Value}>({});
  
  // For tracking items being deleted for animation
  const itemsBeingDeleted = React.useRef<Set<string>>(new Set());
  
  // Refs for swipeable items to properly close them
  const swipeableRefs = React.useRef<{ [key: string]: Swipeable | null }>({});

  // FlatList reference for scrolling
  const flatListRef = React.useRef<SectionList>(null);

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
  const snapPoints = React.useMemo(() => ['55%', '75%'], []);

  const categories = ["Goal", "Health", "Lost"];

  // Animation for TimeCard visibility
  const timeCardHeight = React.useRef(new Animated.Value(0)).current;
  const timeCardOpacity = React.useRef(new Animated.Value(0)).current;

  // Additional animation states for search bar
  const searchBarAnimation = React.useRef(new Animated.Value(0)).current;
  const searchInputFade = React.useRef(new Animated.Value(0)).current;

  const { showActionSheetWithOptions } = useActionSheet();

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

  // Update timer animation when active session changes
  React.useEffect(() => {
    if (activeSession) {
      // Show TimeCard with animation - no scaling, just fade in smoothly
      Animated.parallel([
        Animated.timing(animationValues.jsAnimations.timeCardHeight, {
          toValue: 1,
          duration: 250, // Quicker, more neutral animation
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false
        }),
        Animated.timing(animationValues.jsAnimations.timeCardOpacity, {
          toValue: 1,
          duration: 250, 
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false
        })
      ]).start();
    } else {
      // Hide TimeCard with animation
      Animated.parallel([
        Animated.timing(animationValues.jsAnimations.timeCardHeight, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false
        }),
        Animated.timing(animationValues.jsAnimations.timeCardOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false
        })
      ]).start();
    }
  }, [activeSession]);

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

  const [recentlyUsedIds, setRecentlyUsedIds] = React.useState<string[]>([]);
  const sessionMoveAnim = React.useRef<{[key: string]: Animated.Value}>({});
  
  // Maximum number of recent sessions to display
  const MAX_RECENT_SESSIONS = 5;
  const RECENT_SESSIONS_STORAGE_KEY = 'timemaster:recentSessions';
  
  // Load recently used sessions from storage on mount
  React.useEffect(() => {
    const loadRecentSessions = async () => {
      try {
        const storedSessions = await AsyncStorage.getItem(RECENT_SESSIONS_STORAGE_KEY);
        if (storedSessions) {
          const parsedSessions = JSON.parse(storedSessions) as string[];
          // Filter out any sessions that don't exist anymore
          const validIds = parsedSessions.filter(id => 
            sessions.some(session => session.id === id)
          );
          setRecentlyUsedIds(validIds);
        }
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
      }
    };
    
    loadRecentSessions();
  }, [sessions]);
  
  // Function to add session to recently used
  const addToRecentlyUsed = React.useCallback((sessionId: string) => {
    setRecentlyUsedIds(prev => {
      // Remove the sessionId if it's already in the array
      const filtered = prev.filter(id => id !== sessionId);
      // Add the sessionId at the beginning and limit to max recent
      const updated = [sessionId, ...filtered].slice(0, MAX_RECENT_SESSIONS);
      
      // Save to AsyncStorage
      AsyncStorage.setItem(RECENT_SESSIONS_STORAGE_KEY, JSON.stringify(updated))
        .catch(error => console.error('Failed to save recent sessions:', error));
      
      // If this is an existing session moving to the top (not already at the top),
      // start the animation for that session
      if (filtered.includes(sessionId) && prev[0] !== sessionId) {
        if (!sessionMoveAnim.current[sessionId]) {
          sessionMoveAnim.current[sessionId] = new Animated.Value(0);
        }
        
        // Reset and start animation with improved cubic easing for natural movement
        sessionMoveAnim.current[sessionId].setValue(0);
        Animated.timing(sessionMoveAnim.current[sessionId], {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
      
      return updated;
    });
  }, []);
  
  // Initialize animation values for session movements
  React.useEffect(() => {
    sessions.forEach(session => {
      if (!sessionMoveAnim.current[session.id]) {
        sessionMoveAnim.current[session.id] = new Animated.Value(0);
      }
    });
  }, [sessions]);
  
  // Update recently used when a session is started or resumed
  React.useEffect(() => {
    if (activeSession) {
      addToRecentlyUsed(activeSession.id);
    }
  }, [activeSession, addToRecentlyUsed]);

  const handleStartSession = async () => {
    if (!category || subCategory.trim() === '' || title.trim() === '') {
      return;
    }
    
    console.log("Starting new session");
    
    // Reset animations
    animationValues.jsAnimations.highlight.setValue(0);
    animationValues.nativeAnimations.scale.setValue(1);
    
    try {
      // Create the session
      await startNewSession({
        category,
        subCategory,
        title,
      });
      
      console.log("New session started, active session:", activeSession?.id);
      
      // Find the newly created session (it should be the active one now)
      const newSessionId = activeSession?.id;
      
      // Reset form and close modal
      resetForm();
      setCreateModalVisible(false);
      
      // Add to recently used if we have an ID
      if (newSessionId) {
        addToRecentlyUsed(newSessionId);
        
        // Initialize animation value for the new session
        if (!sessionMoveAnim.current[newSessionId]) {
          sessionMoveAnim.current[newSessionId] = new Animated.Value(0);
        }
        
        // Start move animation - smoother and more subtle, no scaling
        sessionMoveAnim.current[newSessionId].setValue(0);
        Animated.timing(sessionMoveAnim.current[newSessionId], {
          toValue: 1,
          duration: 700,       // Slightly shorter for more responsive feel
          easing: Easing.out(Easing.cubic),  // Cubic easing for natural motion
          useNativeDriver: true,
        }).start();
        
        // Scroll to top with animation when the new session appears
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current?.scrollToLocation?.({
              sectionIndex: 0,
              itemIndex: 0,
              animated: true
            });
          }, 150);  // Slightly delayed scroll for better visual flow
        }
        
        // Start highlight animation sequence for background (non-native) - more subtle
        Animated.timing(animationValues.jsAnimations.highlight, {
          toValue: 0.5,     // Lower maximum value for subtler highlight
          duration: 700,    // Matched duration for consistency
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
        
        // Keep scale at 1 - no zoom animation
        animationValues.nativeAnimations.scale.setValue(1);
      }
    } catch (error) {
      console.error("Error starting session:", error);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    
    console.log("Stopping session:", activeSession.id);
    
    try {
      // Stop session immediately
      await stopSession();
      
      // Close bottom sheet if open
      if (bottomSheetMode === 'timer-view') {
        handleCloseBottomSheet();
      }
      
      // Close any open swipeables
      Object.values(swipeableRefs.current).forEach(ref => ref?.close());
      
      console.log("Session stopped successfully");
    } catch (error) {
      console.error("Error stopping session:", error);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    const sessionToResume = sessions.find(s => s.id === sessionId);
    if (!sessionToResume) return;
    
    console.log("Resuming session:", sessionId);
    
    try {
      // Reset animations
      animationValues.jsAnimations.highlight.setValue(0);
      animationValues.nativeAnimations.scale.setValue(1);
      
      // Resume session immediately
      await resumeSession(sessionId);
      
      console.log("Session resumed successfully");
      
      // Add to recently used
      addToRecentlyUsed(sessionId);
      
      // Start move animation - smoother and more subtle, no scaling
      if (!sessionMoveAnim.current[sessionId]) {
        sessionMoveAnim.current[sessionId] = new Animated.Value(0);
      }
      
      // Reset and start animation
      sessionMoveAnim.current[sessionId].setValue(0);
      Animated.timing(sessionMoveAnim.current[sessionId], {
        toValue: 1,
        duration: 700,        // Slightly shorter for more responsive feel
        easing: Easing.out(Easing.cubic),  // Cubic easing for more natural motion
        useNativeDriver: true,
      }).start();
      
      // Scroll to top to show the now-active session
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToLocation?.({
            sectionIndex: 0,
            itemIndex: 0,
            animated: true
          });
        }, 150);  // Slightly delayed scroll for better visual flow
      }
      
      // Background color animation (non-native) - more subtle, single fade
      Animated.timing(animationValues.jsAnimations.highlight, {
        toValue: 0.5,      // Lower maximum value for subtler highlight
        duration: 700,     // Matched duration for consistency
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      
      // Keep scale at 1 - no zoom animation
      animationValues.nativeAnimations.scale.setValue(1);
      
      // Close any open swipeables
      Object.values(swipeableRefs.current).forEach(ref => ref?.close());
    } catch (error) {
      console.error("Error resuming session:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    // Delete without animation delay
    await deleteSession(sessionId);
    
    // Close any open swipeables
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
  };

  // New method to show delete confirmation
  const showDeleteConfirmation = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteModalVisible(true);
  };
  
  // New method to handle delete confirmation
  const confirmDelete = async () => {
    if (!sessionToDelete) {
      setDeleteModalVisible(false);
      return;
    }
    
    // Find the session being deleted to show in UI
    const sessionBeingDeleted = sessions.find(s => s.id === sessionToDelete);
    
    try {
      console.log(`Deleting session: ${sessionToDelete}`);
      
      // First reset the swipe animation - visual feedback for user
      const translateX = sessionTranslateXValues.current[sessionToDelete];
      if (translateX) {
        // Animate back to center
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 35
        }).start();
        
        // Reset stored offset
        lastOffsetRefs.current[sessionToDelete] = 0;
      }
      
      // Close the modal first for better UX
      setDeleteModalVisible(false);
      
      // Start fade-out animation
      if (sessionItemFadeAnims.current[sessionToDelete]) {
        // Mark as being deleted so we can filter in render
        itemsBeingDeleted.current.add(sessionToDelete);
        
        // Start fade out animation
        Animated.timing(sessionItemFadeAnims.current[sessionToDelete], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(async () => {
          // Perform actual deletion after animation
          await handleDeleteSession(sessionToDelete);
          
          // Remove from being deleted list
          itemsBeingDeleted.current.delete(sessionToDelete);
          
          // Force sync to ensure deletion propagates to server
          if (isOnline && syncWithServer) {
            console.log('Forcing sync after deletion');
            await syncWithServer();
          }
          
          // Reset session to delete state
          setSessionToDelete(null);
        });
      } else {
        // Fallback for if animation somehow isn't available
        await handleDeleteSession(sessionToDelete);
        
        // Force sync to ensure deletion propagates to server
        if (isOnline && syncWithServer) {
          console.log('Forcing sync after deletion');
          await syncWithServer();
        }
        
        // Reset session to delete state
        setSessionToDelete(null);
      }
      
      console.log(`Successfully deleted session: ${sessionToDelete}`);
    } catch (error) {
      console.error('Failed to delete session:', error);
      // Clean up on error
      itemsBeingDeleted.current.delete(sessionToDelete || '');
      setSessionToDelete(null);
    }
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

  // Refs to track gesture state for each item
  const lastOffsetRefs = React.useRef<{[key: string]: number}>({});
  const isSwipeActiveRefs = React.useRef<{[key: string]: boolean}>({});

  // New state for pinned sessions
  const [pinnedSessions, setPinnedSessions] = React.useState<string[]>([]);
  const PINNED_SESSIONS_STORAGE_KEY = 'timemaster:pinnedSessions';
  
  // Load pinned sessions from storage on mount
  React.useEffect(() => {
    const loadPinnedSessions = async () => {
      try {
        const storedSessions = await AsyncStorage.getItem(PINNED_SESSIONS_STORAGE_KEY);
        if (storedSessions) {
          const parsedSessions = JSON.parse(storedSessions) as string[];
          // Filter out any sessions that don't exist anymore
          const validIds = parsedSessions.filter(id => 
            sessions.some(session => session.id === id)
          );
          setPinnedSessions(validIds);
        }
      } catch (error) {
        console.error('Failed to load pinned sessions:', error);
      }
    };
    
    loadPinnedSessions();
  }, [sessions]);

  // Function to handle pinning/unpinning a session
  const togglePinnedSession = React.useCallback((sessionId: string) => {
    setPinnedSessions(prev => {
      let updated: string[];
      
      if (prev.includes(sessionId)) {
        // Remove from pinned sessions
        updated = prev.filter(id => id !== sessionId);
      } else {
        // Add to pinned sessions
        updated = [...prev, sessionId];
      }
      
      // Save to AsyncStorage
      AsyncStorage.setItem(PINNED_SESSIONS_STORAGE_KEY, JSON.stringify(updated))
        .catch(error => console.error('Failed to save pinned sessions:', error));
      
      return updated;
    });
  }, []);

  // Function to handle long press on a session item
  const handleSessionLongPress = React.useCallback((session: TimeSession) => {
    // Close any open swipeables first
    Object.values(swipeableRefs.current).forEach(ref => ref?.close());
    
    const isPinned = pinnedSessions.includes(session.id);
    
    // Show action sheet for session options
    showActionSheetWithOptions(
      {
        options: [
          'Edit Session', 
          isPinned ? 'Unpin Session' : 'Pin Session', 
          'Cancel'
        ],
        cancelButtonIndex: 2,
        destructiveButtonIndex: undefined,
        userInterfaceStyle: isDark ? 'dark' : 'light',
        title: session.subCategory,
        message: `${session.title} - ${formatTimerDisplay(session)}`,
        icons: [
          <Ionicons name="pencil" size={22} color={isDark ? "#a0aec0" : "#4a5568"} />,
          <Ionicons name={isPinned ? "pin-outline" : "pin"} size={22} color={isDark ? "#a0aec0" : "#4a5568"} />,
          <Ionicons name="close" size={22} color={isDark ? "#a0aec0" : "#4a5568"} />
        ],
        tintIcons: true,
        containerStyle: {
          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
          borderRadius: 20,
          overflow: 'hidden',
        },
        textStyle: {
          color: isDark ? '#e5e7eb' : '#1f2937',
        },
      },
      (buttonIndex) => {
        // Handle option selection
        if (buttonIndex === 0) {
          // Edit Session
          handleOpenBottomSheet(session);
          prepareEditSession(session);
        } else if (buttonIndex === 1) {
          // Toggle pin status
          togglePinnedSession(session.id);
          
          // Add animation highlight when pinned
          if (!isPinned) {
            // Initialize animation value for this session if it doesn't exist
            if (!sessionMoveAnim.current[session.id]) {
              sessionMoveAnim.current[session.id] = new Animated.Value(0);
            }
            
            // Reset and start animation
            sessionMoveAnim.current[session.id].setValue(0);
            Animated.timing(sessionMoveAnim.current[session.id], {
              toValue: 1,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();
          }
        }
      }
    );
  }, [showActionSheetWithOptions, pinnedSessions, isDark, formatTimerDisplay, togglePinnedSession, handleOpenBottomSheet, prepareEditSession, handleStopSession, handleResumeSession]);

  // In renderSessionItem function, add the opacity animation
  const renderSessionItem = React.useCallback(({ item }: { item: TimeSession }) => {
    // Create animation value for this item if it doesn't exist
    if (!sessionItemFadeAnims.current[item.id]) {
      sessionItemFadeAnims.current[item.id] = new Animated.Value(1);
    }
    
    // Create translation X value for this swipe if it doesn't exist
    if (!sessionTranslateXValues.current[item.id]) {
      sessionTranslateXValues.current[item.id] = new Animated.Value(0);
    }
    
    // Initialize move animation if it doesn't exist
    if (!sessionMoveAnim.current[item.id]) {
      sessionMoveAnim.current[item.id] = new Animated.Value(0);
    }
    
    // Initialize last offset for this item if it doesn't exist
    if (lastOffsetRefs.current[item.id] === undefined) {
      lastOffsetRefs.current[item.id] = 0;
    }
    
    // Initialize swipe active state for this item if it doesn't exist
    if (isSwipeActiveRefs.current[item.id] === undefined) {
      isSwipeActiveRefs.current[item.id] = false;
    }
    
    const translateX = sessionTranslateXValues.current[item.id];
    const fadeAnimation = sessionItemFadeAnims.current[item.id];
    const moveAnimation = sessionMoveAnim.current[item.id];
    
    // Determine if this item was recently moved to top
    const isRecentlyMoved = recentlyUsedIds[0] === item.id;
    
    // Get category styling
    const categoryStyle = getCategoryColor(item.category);
    
    // Handler for pan gesture
    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationX: translateX } }],
      { useNativeDriver: true }
    );
    
    // Handler for gesture state changes
    const onHandlerStateChange = (event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        // Gesture ended
        isSwipeActiveRefs.current[item.id] = false;
        lastOffsetRefs.current[item.id] = lastOffsetRefs.current[item.id] + event.nativeEvent.translationX;
        
        // Clamp the offset to the maximum swipe distance
        if (lastOffsetRefs.current[item.id] > MAX_SWIPE_DISTANCE) {
          lastOffsetRefs.current[item.id] = MAX_SWIPE_DISTANCE;
        } else if (lastOffsetRefs.current[item.id] < -MAX_SWIPE_DISTANCE) {
          lastOffsetRefs.current[item.id] = -MAX_SWIPE_DISTANCE;
        }
        
        // Decide whether to snap to edge or back to center
        const snapPoint = 
          lastOffsetRefs.current[item.id] > MAX_SWIPE_DISTANCE / 2 
            ? MAX_SWIPE_DISTANCE
            : lastOffsetRefs.current[item.id] < -MAX_SWIPE_DISTANCE / 2
              ? -MAX_SWIPE_DISTANCE
              : 0;
        
        // Animate to snap point with smoothed spring animation
        Animated.spring(translateX, {
          toValue: snapPoint,
          useNativeDriver: true,
          friction: 8,    // Higher friction for smoother animation
          tension: 35     // Lower tension for smoother animation
        }).start();
        
        lastOffsetRefs.current[item.id] = snapPoint;
        
        // Handle action triggers when snapped to edges
        if (snapPoint === MAX_SWIPE_DISTANCE) {
          // Left action (resume/stop)
          if (item.isActive) {
            handleStopSession();
          } else {
            handleResumeSession(item.id);
          }
          // Reset back to center after action with smoothed animation
          setTimeout(() => {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,    // Higher friction for smoother animation
              tension: 35     // Lower tension for smoother animation
            }).start();
            lastOffsetRefs.current[item.id] = 0;
          }, 250);  // Slightly longer delay for better visual feedback
        } else if (snapPoint === -MAX_SWIPE_DISTANCE) {
          // Right action (delete) - Show confirmation instead of deleting directly
          showDeleteConfirmation(item.id);
          
          // Keep the swipe open until user confirms or cancels
          // We'll reset it after the action in those handlers
        }
      } else if (event.nativeEvent.state === State.ACTIVE) {
        isSwipeActiveRefs.current[item.id] = true;
        translateX.setValue(lastOffsetRefs.current[item.id] + event.nativeEvent.translationX);
      }
    };
    
    // Calculate the interpolated values for the action buttons - smoother fade in/out
    const leftActionOpacity = translateX.interpolate({
      inputRange: [0, MAX_SWIPE_DISTANCE * 0.4, MAX_SWIPE_DISTANCE],
      outputRange: [0, 0.8, 1],
      extrapolate: 'clamp',
    });
    
    const rightActionOpacity = translateX.interpolate({
      inputRange: [-MAX_SWIPE_DISTANCE, -MAX_SWIPE_DISTANCE * 0.4, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });
    
    // Enhance highlight animation for recently moved items
    const highlightOpacity = isRecentlyMoved
      ? moveAnimation.interpolate({
          inputRange: [0, 0.2, 0.7, 1],
          outputRange: [0, 0.35, 0.35, 0],
          extrapolate: 'clamp',
        })
      : 0;
    
    // Icon and text for left action based on session state
    const leftIconName = item.isActive ? "pause" : "play";
    const leftBgColor = item.isActive
      ? isDark ? 'rgba(255, 149, 0, 0.8)' : 'rgba(255, 149, 0, 0.7)'
      : categoryStyle.bg;
      
    // Adjust border radius based on swipe direction for smoother corners
    const leftRadius = translateX.interpolate({
      inputRange: [0, MAX_SWIPE_DISTANCE * 0.2, MAX_SWIPE_DISTANCE],
      outputRange: [24, 12, 0],
      extrapolate: 'clamp',
    });
    
    const rightRadius = translateX.interpolate({
      inputRange: [-MAX_SWIPE_DISTANCE, -MAX_SWIPE_DISTANCE * 0.2, 0],
      outputRange: [0, 12, 24],
      extrapolate: 'clamp',
    });
    
    // Determine if this item is pinned
    const isPinned = pinnedSessions.includes(item.id);
    
    return (
      <Animated.View 
        style={[
          styles.swipeableContainer,
          { 
            opacity: fadeAnimation,
          }
        ]}
      >
        {/* Background highlight - separate Animated.View with JS driver */}
        {(item.isActive || isRecentlyMoved || isPinned) && (
          <Animated.View 
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: item.isActive 
                  ? animationValues.jsAnimations.highlight.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(108, 92, 231, 0)', `${categoryStyle.bg}80`]
                    })
                  : isRecentlyMoved 
                    ? categoryStyle.bg
                    : isPinned 
                      ? isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)'
                      : 'transparent',
                borderRadius: 24,
                opacity: item.isActive ? 1 : highlightOpacity,
                zIndex: -1
              }
            ]}
          />
        )}
        
        {/* Left Action (Resume/Stop) - with smoother fade in/out */}
        <Animated.View 
          style={[
            styles.leftAction,
            { 
              opacity: leftActionOpacity,
              backgroundColor: leftBgColor,
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24,
              borderTopRightRadius: leftRadius,  // Dynamic border radius that adjusts during swipe
              borderBottomRightRadius: leftRadius,  // Dynamic border radius that adjusts during swipe
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [0, MAX_SWIPE_DISTANCE],
                  outputRange: [-5, 0],  // More subtle slide-in effect
                  extrapolate: 'clamp',
                })
              }]
            }
          ]}
        >
          <View style={styles.actionButton}>
            <Ionicons 
              name={leftIconName} 
              size={28} 
              color={categoryStyle.text} 
              style={{ opacity: 0.95 }} 
            />
          </View>
        </Animated.View>
        
        {/* Right Action (Delete) - with smoother fade in/out */}
        <Animated.View 
          style={[
            styles.rightAction,
            { 
              opacity: rightActionOpacity,
              borderTopRightRadius: 24,
              borderBottomRightRadius: 24,
              borderTopLeftRadius: rightRadius,  // Dynamic border radius that adjusts during swipe
              borderBottomLeftRadius: rightRadius,  // Dynamic border radius that adjusts during swipe
              transform: [{
                translateX: translateX.interpolate({
                  inputRange: [-MAX_SWIPE_DISTANCE, 0],
                  outputRange: [0, 5],  // More subtle slide-in effect
                  extrapolate: 'clamp',
                })
              }]
            }
          ]}
        >
          <View style={styles.actionButton}>
            <Ionicons 
              name="trash-outline" 
              size={28} 
              color="white"
              style={{ opacity: 0.95 }} 
            />
          </View>
        </Animated.View>
        
        {/* Main Content */}
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={[-10, 10]}  // Start gesture tracking after 10px movement for more intentional swipes
        >
          <Animated.View 
            style={[
              styles.rowFront,
              {
                borderTopLeftRadius: rightRadius,
                borderBottomLeftRadius: rightRadius,
                borderTopRightRadius: leftRadius,
                borderBottomRightRadius: leftRadius,
                transform: [
                  { 
                    translateX: translateX.interpolate({
                      inputRange: [-MAX_SWIPE_DISTANCE, 0, MAX_SWIPE_DISTANCE],
                      outputRange: [-MAX_SWIPE_DISTANCE, 0, MAX_SWIPE_DISTANCE],
                      extrapolate: 'clamp',
                    })
                  }
                ]
              }
            ]}
          >
            <TouchableOpacity 
              onPress={() => {
                // Single press now plays/pauses the session
                if (item.isActive) {
                  console.log("Stop button pressed for session:", item.id);
                  handleStopSession();
                } else {
                  handleResumeSession(item.id);
                }
              }}
              onLongPress={() => handleSessionLongPress(item)}
              delayLongPress={300}
              className={`p-4 ${
                item.isActive 
                  ? 'bg-white dark:bg-gray-800' 
                  : 'bg-white dark:bg-gray-900'
              }`}
              activeOpacity={0.8}
              style={{
                borderTopLeftRadius: rightRadius,
                borderBottomLeftRadius: rightRadius,
                borderTopRightRadius: leftRadius,
                borderBottomRightRadius: leftRadius,
              }}
            >
              {item.isActive ? (
                // Active session UI
                <View className='flex-row items-center'>
                  <View className='h-12 w-12 rounded-xl justify-center items-center mr-4' 
                    style={{ backgroundColor: categoryStyle.bg }}>
                    <FontAwesome5 name={categoryStyle.icon} size={20} color={categoryStyle.text} style={{ opacity: 0.7 }} />
                  </View>
                  <View className='flex-1'>
                    <View className='flex-row items-center'>
                      <Text className='text-lg font-bold text-gray-800 dark:text-gray-100'>
                        {item.subCategory}
                      </Text>
                      {isPinned && (
                        <Ionicons name="pin" size={14} color={isDark ? "#f59e0b" : "#d97706"} style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <View className='flex-row flex-wrap'>
                      <View 
                        style={{ backgroundColor: categoryStyle.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}
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
                    <View className='flex-row items-center mt-1'>
                      <View className='h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse'></View>
                      <Text className='text-xs text-green-600 dark:text-green-400'>active</Text>
                    </View>
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
                    <View className='flex-row items-center'>
                      <Text className='text-lg font-medium text-gray-500 dark:text-gray-100'>
                        {item.subCategory}
                      </Text>
                      {isPinned && (
                        <Ionicons name="pin" size={14} color={isDark ? "#f59e0b" : "#d97706"} style={{ marginLeft: 6 }} />
                      )}
                    </View>
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
                    {/* <Text className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
                      tap to start
                    </Text> */}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    );
  }, [
    currentTime, 
    formatTimerDisplay, 
    handleOpenBottomSheet, 
    prepareEditSession,
    handleStopSession,
    handleResumeSession,
    handleDeleteSession,
    animationValues,
    isDark,
    recentlyUsedIds,
    addToRecentlyUsed,
    pinnedSessions,
    handleSessionLongPress
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

  // Prepare data for section list
  const prepareSectionedData = React.useMemo(() => {
    // Filter out sessions being deleted
    const visibleSessions = sessions.filter(s => !itemsBeingDeleted.current.has(s.id));
    
    // Apply search filter if search term exists
    const filteredSessions = searchTerm.trim()
      ? visibleSessions.filter(session => {
          const searchLower = searchTerm.toLowerCase();
          return (
            (session.subCategory?.toLowerCase().includes(searchLower) || 
             session.title?.toLowerCase().includes(searchLower) || 
             session.category?.toLowerCase().includes(searchLower))
          );
        })
      : visibleSessions;
    
    // Get pinned sessions
    const pinnedSessionItems = pinnedSessions
      .map(id => filteredSessions.find(s => s.id === id))
      .filter(Boolean) as TimeSession[];
    
    // Get recent sessions based on recentlyUsedIds, excluding pinned ones
    const recentSessions = recentlyUsedIds
      .map(id => filteredSessions.find(s => s.id === id && !pinnedSessions.includes(id)))
      .filter(Boolean) as TimeSession[];
    
    // Get other sessions, excluding those in recent and pinned
    const otherSessions = filteredSessions.filter(
      s => !recentlyUsedIds.includes(s.id) && !pinnedSessions.includes(s.id)
    );
    
    const sections = [];
    
    // Add pinned section if it has items
    if (pinnedSessionItems.length > 0) {
      sections.push({
        title: 'Pinned',
        data: pinnedSessionItems
      });
    }
    
    // Add recent section if it has items
    if (recentSessions.length > 0) {
      sections.push({
        title: 'Recent',
        data: recentSessions
      });
    }
    
    // Add other sessions if there are any
    if (otherSessions.length > 0) {
      sections.push({
        title: 'All Sessions',
        data: otherSessions
      });
    }
    
    return sections;
  }, [sessions, recentlyUsedIds, searchTerm, pinnedSessions]);

  // Reset search animations when component mounts
  React.useEffect(() => {
    if (!searchVisible) {
      searchBarAnimation.setValue(0);
      searchInputFade.setValue(0);
    }
  }, []);

  // Function to animate search bar open with position fixed at section header location
  const openSearchBar = () => {
    // Set searchVisible immediately so the component renders input
    setSearchVisible(true);
    
    // Schedule animations for next frame to ensure components are mounted
    requestAnimationFrame(() => {
      // First animate the container expansion
      Animated.spring(searchBarAnimation, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: false
      }).start();
      
      // Then fade in the input with slight delay
      setTimeout(() => {
        Animated.timing(searchInputFade, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false
        }).start();
      }, 100);
    });
  };

  // Function to animate search bar close
  const closeSearchBar = () => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    
    // First fade out the input
    Animated.timing(searchInputFade, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false
    }).start();
    
    // Then collapse the container
    setTimeout(() => {
      Animated.spring(searchBarAnimation, {
        toValue: 0,
        friction: 6,
        tension: 40,
        useNativeDriver: false
      }).start(() => {
        setSearchVisible(false);
        setSearchTerm('');
      });
    }, 100);
  };

  // Interpolate animation values for search elements
  const searchBarWidth = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['14%', '94%']
  });

  const searchBarHeight = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 56]
  });

  const searchBarBorderRadius = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 16]
  });

  const searchIconScale = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85]
  });

  const searchIconOpacity = searchInputFade.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.3, 0]
  });

  const searchIconLeft = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 16]
  });

  // Add animation for top position to enhance the effect
  const searchBarTop = searchBarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 2]
  });

  // Handle keyboard dismissal when search loses focus
  const handleSearchBlur = () => {
    if (searchTerm.trim() === '') {
      closeSearchBar();
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <Animated.View 
          className='flex-1 dark:bg-black'
          style={{ backgroundColor: '#fafaff' }}
        >
          <View className='flex-1 px-4 pt-2'>
            {/* Floating Search Bar - appears when search is active */}
            {searchVisible && (
              <Animated.View 
                className='absolute top-3 left-4 right-4 z-50'
                style={{
                  height: 50,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: searchBarAnimation
                }}
              >
                {/* Search Input */}
                <Animated.View 
                  style={{
                    flex: 1,
                    paddingLeft: 16,
                    paddingRight: 10,
                    opacity: searchInputFade
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons 
                      name="search" 
                      size={20} 
                      color={isDark ? "#9ca3af" : "#6b7280"} 
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      className='flex-1 text-gray-700 dark:text-gray-200'
                      placeholder="Search sessions..."
                      placeholderTextColor={isDark ? "#9ca3af" : "#6b7280"}
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      autoFocus={true}
                    />
                  </View>
                </Animated.View>
                
                {/* Close Button */}
                <Animated.View 
                  style={{
                    opacity: searchInputFade,
                    paddingRight: 12
                  }}
                >
                  <TouchableOpacity
                    onPress={closeSearchBar}
                    className='w-8 h-8 justify-center items-center rounded-full bg-gray-200 dark:bg-gray-700'
                  >
                    <Ionicons name="close" size={16} color={isDark ? "#e5e7eb" : "#4b5563"} />
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            )}
            
            {/* Sessions list */}
            {sessions.length === 0 ? (
              <Animated.View 
                className='flex-1 justify-center items-center px-6'
              >
                <Ionicons 
                  name="time-outline" 
                  size={42} 
                  color={isDark ? "#a0aec0" : "#718096"} 
                  style={{ marginBottom: 16, opacity: 0.8 }}
                />
                <Text className='text-base font-medium text-gray-600 dark:text-gray-400 text-center'>
                  No tracked time yet
                </Text>
                <Text className='text-sm text-gray-400 dark:text-gray-500 text-center mt-2'>
                  The clock is ticking. Ready when you are.
                </Text>
              </Animated.View>
            ) : prepareSectionedData.length === 0 && searchTerm.trim() !== '' ? (
              // No search results
              <View className='flex-1 justify-center items-center px-6'>
                <Ionicons 
                  name="search-outline" 
                  size={42} 
                  color={isDark ? "#a0aec0" : "#718096"} 
                  style={{ marginBottom: 16, opacity: 0.8 }}
                />
                <Text className='text-base font-medium text-gray-600 dark:text-gray-400 text-center'>
                  No sessions match "{searchTerm}"
                </Text>
                <TouchableOpacity 
                  onPress={() => setSearchTerm('')} 
                  className='mt-4 px-4 py-2 bg-blue-500 rounded-lg'
                >
                  <Text className='text-white font-medium'>Clear Search</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <SectionList
                ref={flatListRef as any}
                sections={prepareSectionedData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderSessionItem({ item })}
                renderSectionHeader={({ section: { title } }) => (
                  <Animated.View 
                    className={`py-2 px-3 ${title === 'Recent' ? 'bg-gray-50/80 dark:bg-gray-800/30 rounded-lg mx-1 mt-0' : 'mt-3'}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <View>
                      <Text className='text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400'>
                        {title}
                      </Text>
                    </View>
                    
                    {/* Search icon that appears in section headers */}
                    <TouchableOpacity
                      onPress={openSearchBar}
                      disabled={searchVisible}
                      className={`w-8 h-8 justify-center items-center rounded-full ${searchVisible ? 'opacity-50' : ''} ${title === 'Recent' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                    >
                      <Ionicons 
                        name={searchVisible ? "search" : "search-outline"} 
                        size={18} 
                        color={isDark ? "#9ca3af" : "#6b7280"} 
                      />
                    </TouchableOpacity>
                  </Animated.View>
                )}
                stickySectionHeadersEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ 
                  paddingBottom: 80,
                  paddingTop: 0,
                }}
                maxToRenderPerBatch={8}
                windowSize={10}
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
              className={`absolute bottom-3 self-center w-16 h-16 rounded-full justify-center items-center ${
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
              <View className='flex-1 justify-center items-center bg-black/50 px-5'>
                <View className='bg-white dark:bg-gray-800 rounded-[40px] p-6 w-full max-w-lg'>
                  <Text className='text-xl font-semibold mb-10 text-gray-800 dark:text-gray-100 text-center'>Track your time</Text>
                  
                  {/* Category Selection with icons */}
                  <View className='flex-row justify-center mb-6 px-2'>
                    {categories.map((cat) => {
                      const catColor = getCategoryColor(cat);
                      const isSelected = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setCategory(cat)}
                          className={`items-center mx-2`}
                          style={{ width: '28%' }}
                        >
                          <View 
                            style={{ 
                              backgroundColor: isSelected 
                                ? isDark 
                                  ? cat === 'Goal' ? '#1e3a8a' : cat === 'Health' ? '#065f46' : '#9d174d'
                                  : cat === 'Goal' ? '#dbeafe' : cat === 'Health' ? '#d1fae5' : '#fce7f3'
                                : isDark ? 'rgba(30,30,30,0.3)' : 'rgba(250,250,250,0.9)',
                              borderWidth: isSelected ? 0 : 1,
                              borderColor: isDark ? '#4b5563' : '#e5e7eb',
                              width: 58, 
                              height: 58, 
                              borderRadius: 18,
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginBottom: 5,
                              shadowColor: isSelected ? 
                                (cat === 'Goal' ? '#60a5fa' : cat === 'Health' ? '#34d399' : '#f472b6') : 
                                'transparent',
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: isSelected ? 0.5 : 0,
                              shadowRadius: 4,
                              elevation: isSelected ? 3 : 0
                            }}
                          >
                            <FontAwesome5 
                              name={catColor.icon} 
                              size={20} 
                              color={isSelected 
                                ? isDark ? '#fff' : cat === 'Goal' ? '#1e3a8a' : cat === 'Health' ? '#065f46' : '#9d174d'
                                : isDark ? '#a0aec0' : '#718096'
                              } 
                            />
                          </View>
                          <Text 
                            className={`text-xs font-medium ${
                              isSelected 
                                ? cat === 'Goal' 
                                  ? 'text-blue-600 dark:text-blue-400' 
                                  : cat === 'Health' 
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-pink-600 dark:text-pink-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {cat}
                          </Text>
                          {isSelected && (
                            <View 
                              style={{ 
                                width: 4, 
                                height: 4, 
                                borderRadius: 2,
                                backgroundColor: cat === 'Goal' ? '#3b82f6' : cat === 'Health' ? '#10b981' : '#ec4899',
                                marginTop: 2
                              }} 
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {/* Inputs with icons */}
                  <View className='mb-6 px-1'>
                    <View 
                      className='flex-row items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-3'
                      style={{
                        borderLeftWidth: 3, 
                        borderLeftColor: category ? 
                          (category === 'Goal' ? '#3b82f6' : category === 'Health' ? '#10b981' : '#ec4899') : 
                          '#9ca3af'
                      }}
                    >
                      <Ionicons name="bookmark-outline" size={18} color={isDark ? '#a0aec0' : '#718096'} style={{ marginRight: 10 }} />
                      <TextInput
                        className='flex-1 text-gray-800 dark:text-gray-100'
                        placeholder="What are you doing? (e.g. Writing, Coding)"
                        placeholderTextColor="#9ca3af"
                        value={subCategory}
                        onChangeText={setSubCategory}
                      />
                    </View>
                    
                    <View 
                      className='flex-row items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl'
                      style={{
                        borderLeftWidth: 3, 
                        borderLeftColor: category ? 
                          (category === 'Goal' ? '#3b82f6' : category === 'Health' ? '#10b981' : '#ec4899') : 
                          '#9ca3af'
                      }}
                    >
                      <Ionicons name="text-outline" size={18} color={isDark ? '#a0aec0' : '#718096'} style={{ marginRight: 10 }} />
                      <TextInput
                        className='flex-1 text-gray-800 dark:text-gray-100'
                        placeholder="Add details"
                        placeholderTextColor="#9ca3af"
                        value={title}
                        onChangeText={setTitle}
                      />
                    </View>
                  </View>
                  
                  {/* Action Buttons - icon only, no text */}
                  <View className='flex-row justify-center mb-5 px-1 mt-2'>
                    <TouchableOpacity 
                      onPress={handleStartSession}
                      disabled={!category || subCategory.trim() === '' || title.trim() === ''}
                      className={`items-center justify-center rounded-full mr-5 ${
                        (!category || subCategory.trim() === '' || title.trim() === '')
                          ? 'opacity-40' 
                          : ''
                      }`}
                      style={{
                        backgroundColor: category 
                          ? (category === 'Goal' ? '#3b82f6' : category === 'Health' ? '#10b981' : '#ec4899')
                          : '#9ca3af',
                        width: 68,
                        height: 68
                      }}
                    >
                      <Ionicons name="play" size={28} color="white" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={saveWithoutStarting}
                      disabled={!category || subCategory.trim() === '' || title.trim() === ''}
                      className={`items-center justify-center rounded-full ${
                        (!category || subCategory.trim() === '' || title.trim() === '')
                          ? 'opacity-40' 
                          : ''
                      }`}
                      style={{
                        backgroundColor: isDark ? 'rgba(50,50,50,0.8)' : 'rgba(240,240,240,0.9)',
                        borderWidth: 1,
                        borderColor: isDark ? '#4b5563' : '#e5e7eb',
                        width: 68,
                        height: 68
                      }}
                    >
                      <Ionicons 
                        name="bookmark" 
                        size={26} 
                        color={category 
                          ? (category === 'Goal' ? '#3b82f6' : category === 'Health' ? '#10b981' : '#ec4899')
                          : (isDark ? '#e2e8f0' : '#4b5563')
                        } 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Close button positioned at bottom of screen */}
                <TouchableOpacity 
                  onPress={() => {
                    resetForm();
                    setCreateModalVisible(false);
                  }}
                  className='absolute bottom-16 left-0 right-0 items-center'
                >
                  <View className='w-16 h-16 rounded-full bg-white dark:bg-gray-700 items-center justify-center'
                    style={{
                      borderWidth: 1,
                      borderColor: isDark ? '#4b5563' : '#e5e7eb',
                    }}
                  >
                    <Ionicons name="close" size={24} color={isDark ? '#a0aec0' : '#4b5563'} />
                  </View>
                </TouchableOpacity>
              </View>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
              animationType="fade"
              transparent={true}
              visible={deleteModalVisible}
              onRequestClose={() => {
                setDeleteModalVisible(false);
                // Reset any open swipe animations
                if (sessionToDelete) {
                  const translateX = sessionTranslateXValues.current[sessionToDelete];
                  if (translateX) {
                    Animated.spring(translateX, {
                      toValue: 0,
                      useNativeDriver: true,
                    }).start();
                    lastOffsetRefs.current[sessionToDelete] = 0;
                  }
                }
              }}
            >
              <View className='flex-1 justify-center items-center bg-black/40 px-5'>
                <View className='bg-white dark:bg-gray-800 rounded-3xl p-5 w-full max-w-lg'>
                  <Text className='text-2xl font-bold mb-3 text-center text-gray-800 dark:text-gray-100'>Delete Session?</Text>
                  
                  {sessionToDelete && (
                    <View className='p-4 mb-4 bg-gray-100 dark:bg-gray-700 rounded-xl'>
                      <Text className='font-semibold mb-1 text-gray-800 dark:text-gray-200'>
                        {sessions.find(s => s.id === sessionToDelete)?.subCategory || 'Session'}
                      </Text>
                      <Text className='text-sm text-gray-600 dark:text-gray-300'>
                        {sessions.find(s => s.id === sessionToDelete)?.title || ''}
                      </Text>
                      {sessions.find(s => s.id === sessionToDelete)?.elapsedTime && (
                        <Text className='text-sm mt-1 text-gray-500 dark:text-gray-400'>
                          Duration: {formatTimerDisplay(sessions.find(s => s.id === sessionToDelete)!)}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  <Text className='mb-6 text-center text-gray-600 dark:text-gray-300'>
                    This action cannot be undone and will remove this session from all your devices.
                  </Text>
                  
                  {/* Action Buttons */}
                  <View className='flex-row justify-between mb-2'>
                    <TouchableOpacity 
                      onPress={confirmDelete}
                      className='bg-red-500 rounded-xl py-3 flex-1 mr-2'
                    >
                      <Text className='text-white font-medium text-center'>
                        Delete
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => {
                        // Reset the swipe animation
                        if (sessionToDelete) {
                          const translateX = sessionTranslateXValues.current[sessionToDelete];
                          if (translateX) {
                            Animated.spring(translateX, {
                              toValue: 0,
                              useNativeDriver: true,
                            }).start();
                            lastOffsetRefs.current[sessionToDelete] = 0;
                          }
                        }
                        setDeleteModalVisible(false);
                        setSessionToDelete(null);
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
              <View className='p-6'>
                
                {/* Category display - not editable */}
                <View className='flex-row items-center mb-6'>
                  <View 
                    style={{ 
                      backgroundColor: isDark 
                        ? selectedSession.category === 'Goal' ? 'rgba(30, 58, 138, 0.3)' : selectedSession.category === 'Health' ? 'rgba(6, 95, 70, 0.3)' : 'rgba(157, 23, 77, 0.3)'
                        : selectedSession.category === 'Goal' ? 'rgba(219, 234, 254, 0.8)' : selectedSession.category === 'Health' ? 'rgba(209, 250, 229, 0.8)' : 'rgba(252, 231, 243, 0.8)',
                      width: 42, 
                      height: 42, 
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12
                    }}
                  >
                    <FontAwesome5 
                      name={getCategoryColor(selectedSession.category).icon} 
                      size={18} 
                      color={isDark 
                        ? selectedSession.category === 'Goal' ? '#93c5fd' : selectedSession.category === 'Health' ? '#6ee7b7' : '#f9a8d4'
                        : selectedSession.category === 'Goal' ? '#1e3a8a' : selectedSession.category === 'Health' ? '#065f46' : '#9d174d'
                      } 
                    />
                  </View>
                  <View>
                    <Text 
                      className={`text-xl font-medium ${
                        selectedSession.category === 'Goal' 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : selectedSession.category === 'Health' 
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-pink-600 dark:text-pink-400'
                      }`}
                    >
                      {selectedSession.category}
                    </Text>
                  </View>
                </View>
                
                {/* Editable name fields */}
                <View className='mb-5 px-1'>
                  <Text className='text-xs font-medium mb-2 text-gray-500 dark:text-gray-400 ml-1'>
                    Name
                  </Text>
                  <View 
                    className='flex-row items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-3'
                    style={{
                      borderLeftWidth: 3, 
                      borderLeftColor: selectedSession.category === 'Goal' ? '#3b82f6' : selectedSession.category === 'Health' ? '#10b981' : '#ec4899'
                    }}
                  >
                    <TextInput
                      className='flex-1 text-gray-800 dark:text-gray-100'
                      placeholder="What are you doing? (e.g. Writing, Coding)"
                      placeholderTextColor="#9ca3af"
                      value={subCategory}
                      onChangeText={setSubCategory}
                    />
                  </View>
                  
                  <Text className='text-xs font-medium mb-2 text-gray-500 dark:text-gray-400 ml-1'>
                    Details
                  </Text>
                  <View 
                    className='flex-row items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-xl'
                    style={{
                      borderLeftWidth: 3, 
                      borderLeftColor: selectedSession.category === 'Goal' ? '#3b82f6' : selectedSession.category === 'Health' ? '#10b981' : '#ec4899'
                    }}
                  >
                    <TextInput
                      className='flex-1 text-gray-800 dark:text-gray-100'
                      placeholder="Add details"
                      placeholderTextColor="#9ca3af"
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>
                </View>

                {/* Session details - timestamps */}
                <View className='bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-6'>
                  <View className='flex-row justify-between items-center mb-3'>
                    <View className='flex-row items-center'>
                      <Text className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                        Last tracked
                      </Text>
                    </View>
                    <Text className='text-xs text-gray-600 dark:text-gray-300'>
                      {selectedSession.isActive ? 'Now' : 
                        selectedSession.endTime ? 
                          `${new Date(selectedSession.endTime).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric' 
                          })}, ${formatTime(new Date(selectedSession.endTime))}` : 
                          'Never tracked'}
                    </Text>
                  </View>
                  
                  <View className='flex-row justify-between items-center'>
                    <View className='flex-row items-center'>
                      <Text className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                        Total duration
                      </Text>
                    </View>
                    <Text className='text-xs font-medium' style={{ color: selectedSession.category === 'Goal' ? '#3b82f6' : selectedSession.category === 'Health' ? '#10b981' : '#ec4899' }}>
                      {formatTimerDisplay(selectedSession)}
                    </Text>
                  </View>
                </View>
                
                {/* Save button */}
                <TouchableOpacity 
                  onPress={handleUpdateSession}
                  disabled={subCategory.trim() === '' || title.trim() === ''}
                  className={`items-center justify-center rounded-full ${
                    (subCategory.trim() === '' || title.trim() === '')
                      ? 'opacity-40' 
                      : ''
                  }`}
                  style={{
                    backgroundColor: selectedSession.category === 'Goal' ? '#3b82f6' : selectedSession.category === 'Health' ? '#10b981' : '#ec4899',
                    height: 50,
                    shadowColor: selectedSession.category === 'Goal' ? '#60a5fa' : selectedSession.category === 'Health' ? '#34d399' : '#f472b6',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 3
                  }}
                >
                  <Text className='text-white font-medium'>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {bottomSheetMode === 'timer-view' && selectedSession && (
              <View className='p-5 items-center'>
                <Text className='text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100'>
                  Active Session
                </Text>
                
                <View 
                  className='w-full rounded-2xl p-8 mb-6 items-center'
                  style={{
                    backgroundColor: getCategoryColor(selectedSession.category).bg,
                  }}
                >
                  <Text 
                    className='text-5xl font-bold'
                    style={{ color: getCategoryColor(selectedSession.category).text }}
                  >
                    {formatTimerDisplay(selectedSession)}
                  </Text>
                </View>
                
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
                    onPress={() => {
                      console.log("Stop button pressed from timer view");
                      handleStopSession();
                    }}
                    className='rounded-full p-5 mr-5'
                    style={{ 
                      backgroundColor: getCategoryColor(selectedSession.category).bg,
                      borderWidth: 1.5,
                      borderColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
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
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
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
    backgroundColor: '#fff',
  },
  activeSessionCard: {
    marginBottom: 3,
    backgroundColor: '#fff',
  },
  rightAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MAX_SWIPE_DISTANCE,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    overflow: 'hidden',
  },
  leftAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MAX_SWIPE_DISTANCE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    overflow: 'hidden',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  resumeButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.5)',
  },
  swipeableContainer: {
    position: 'relative',
    marginBottom: 10,
    overflow: 'hidden',
  },
  rowFront: {
    zIndex: 2,
    overflow: 'hidden',
  },
});