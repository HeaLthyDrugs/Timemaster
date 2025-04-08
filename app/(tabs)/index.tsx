import { Stack } from 'expo-router';
import * as React from 'react';
import {
  Button as RNButton,
  View,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TimeCard from '~/components/TimeCard';
import AsyncStorage from '@react-native-async-storage/async-storage'

// Define type for time tracking session
type TimeSession = {
  id: string;
  category: string;
  subCategory: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  saved?: boolean; // New property to track saved sessions
};

// Key for storing sessions in AsyncStorage
const STORAGE_KEY = 'time_sessions';

export default function Home() {
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  const [category, setCategory] = React.useState<string | null>(null);
  const [subCategory, setSubCategory] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [sessions, setSessions] = React.useState<TimeSession[]>([]);
  const [activeSession, setActiveSession] = React.useState<TimeSession | null>(null);
  const [selectedSession, setSelectedSession] = React.useState<TimeSession | null>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Bottom sheet references
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ['65%', '75%'], []);

  const categories = ["Goal", "Health", "Unwilling"];

  // Load sessions from AsyncStorage when component mounts
  React.useEffect(() => {
    loadSessions();
  }, []);

  // Update timer every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Save sessions to AsyncStorage whenever sessions change
  React.useEffect(() => {
    if (!isLoading) {
      saveSessions();
    }
  }, [sessions]);

  // Load sessions from AsyncStorage
  const loadSessions = async () => {
    try {
      const storedSessions = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions);
        
        // Convert string dates back to Date objects
        const sessionsWithDates = parsedSessions.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined
        }));
        
        setSessions(sessionsWithDates);
        
        // Check if there's an active session
        const active = sessionsWithDates.find((session: TimeSession) => session.isActive);
        if (active) {
          setActiveSession(active);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions from storage', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save sessions to AsyncStorage
  const saveSessions = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions to storage', error);
    }
  };

  const handleOpenBottomSheet = (session: TimeSession) => {
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

  const startSession = () => {
    if (!category || subCategory.trim() === '' || title.trim() === '') {
      return; // Don't start if fields are empty
    }

    const newSession: TimeSession = {
      id: Date.now().toString(),
      category: category,
      subCategory: subCategory,
      title: title,
      startTime: new Date(),
      isActive: true,
      saved: false,
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    resetForm();
    setCreateModalVisible(false);
  };

  // New function to save a session without starting it
  const saveWithoutStarting = () => {
    if (!category || subCategory.trim() === '' || title.trim() === '') {
      return; // Don't save if fields are empty
    }

    const newSession: TimeSession = {
      id: Date.now().toString(),
      category: category,
      subCategory: subCategory,
      title: title,
      startTime: new Date(),
      isActive: false,
      saved: true,
    };

    setSessions(prev => [newSession, ...prev]);
    resetForm();
    setCreateModalVisible(false);
  };

  const saveSession = () => {
    if (activeSession) {
      setSessions(prev => 
        prev.map(session => 
          session.id === activeSession.id 
            ? { ...session, endTime: new Date(), isActive: false } 
            : session
        )
      );
      setActiveSession(null);
    }
  };

  const updateSession = () => {
    if (selectedSession) {
      setSessions(prev => 
        prev.map(session => 
          session.id === selectedSession.id 
            ? { 
                ...session, 
                category: category || session.category,
                subCategory: subCategory || session.subCategory,
                title: title || session.title
              } 
            : session
        )
      );
      resetForm();
      handleCloseBottomSheet();
    }
  };

  const deleteSession = () => {
    if (selectedSession) {
      setSessions(prev => prev.filter(session => session.id !== selectedSession.id));
      
      // If we're deleting the active session, clear it
      if (activeSession && activeSession.id === selectedSession.id) {
        setActiveSession(null);
      }
      
      handleCloseBottomSheet();
    }
  };

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

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const diffMs = end.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const secs = Math.floor((diffMs % 60000) / 1000);
    
    return `${hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimerDisplay = (startTime: Date, currentTime: Date) => {
    const diffMs = currentTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <View className='flex-1 bg-white dark:bg-gray-900'>
          <View className='flex-1 p-4'>
            
            {/* Time Card  */}
            <View className='mb-4'>
              <TimeCard time={formatTimerDisplay(currentTime, currentTime)} onTimeChange={() => {}} />
            </View>

            {/* Sessions List */}
            <Text className='text-md font-semibold mb-4 text-gray-400 dark:text-gray-100'>Sessions</Text>
            
            {sessions.length === 0 ? (
              <View className='flex-1 justify-center items-center'>
                <Text className='text-gray-500 dark:text-gray-400'>No sessions yet. Tap + to start tracking time.</Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    onPress={() => {
                      handleOpenBottomSheet(item);
                      prepareEditSession(item);
                    }}
                    className={`p-4 rounded-3xl mb-3 border border-gray-200 dark:border-gray-700 ${
                      item.isActive 
                        ? 'bg-white dark:bg-gray-800' 
                        : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    {item.isActive ? (
                      // Active session UI (like second image)
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
                            {formatTimerDisplay(item.startTime, currentTime)}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => {
                              // Pause the active session
                              saveSession();
                            }}
                            className='mt-1'
                          >
                            <Ionicons name="pause" size={24} color="#6C5CE7" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      // Paused or saved session UI (like first image)
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
                            {item.saved ? '' : formatDuration(item.startTime, item.endTime)}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => {
                              // Start the session
                              const updatedSession = {...item, isActive: true, saved: false, startTime: new Date()};
                              setSessions(prev => 
                                prev.map(session => 
                                  session.id === item.id ? updatedSession : session
                                )
                              );
                              setActiveSession(updatedSession);
                            }}
                            className='mt-1'
                          >
                            <Ionicons name="play" size={24} color="#6C5CE7" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {/* Add Session Floating Button */}
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setCreateModalVisible(true);
              }}
              disabled={!!activeSession} // Disable if there's an active session
              className={`absolute bottom-6 self-center w-14 h-14 rounded-full justify-center items-center shadow-lg ${
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
                      onPress={startSession}
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

            {/* Edit Session Bottom Sheet */}
            <BottomSheetModal
              ref={bottomSheetModalRef}
              index={0}
              snapPoints={snapPoints}
              backgroundStyle={{ backgroundColor: '#fff' }}
              handleIndicatorStyle={{ backgroundColor: '#999' }}
              backdropComponent={renderBackdrop}
            >
              <View className='p-6'>
                <Text className='text-2xl font-bold mb-6 text-center text-gray-800'>Edit Session</Text>
                
                {/* Category Selection */}
                <Text className='font-medium mb-2 text-gray-700'>Category</Text>
                <View className='flex-row flex-wrap mb-4'>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                        category === cat 
                          ? 'bg-purple-500' 
                          : 'bg-gray-200'
                      }`}
                    >
                      <Text 
                        className={`${
                          category === cat 
                            ? 'text-white' 
                            : 'text-gray-800'
                        }`}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Sub-category Input */}
                <Text className='font-medium mb-2 text-gray-700'>Sub-category</Text>
                <TextInput
                  className='bg-gray-100 p-3 rounded-xl mb-4 text-gray-800'
                  placeholder="Enter sub-category"
                  placeholderTextColor="#9ca3af"
                  value={subCategory}
                  onChangeText={setSubCategory}
                />
                
                {/* Title Input */}
                <Text className='font-medium mb-2 text-gray-700'>Title</Text>
                <TextInput
                  className='bg-gray-100 p-3 rounded-xl mb-6 text-gray-800'
                  placeholder="What are you working on?"
                  placeholderTextColor="#9ca3af"
                  value={title}
                  onChangeText={setTitle}
                />
                
                {/* Action Buttons */}
                <View className='flex-row justify-between mb-4'>
                  <TouchableOpacity 
                    onPress={updateSession}
                    className='flex-row items-center justify-center bg-purple-500 rounded-xl py-3 flex-1 mr-2'
                  >
                    <Ionicons name="checkmark" size={18} color="white" style={{ marginRight: 5 }} />
                    <Text className='text-white font-medium text-center'>
                      Update
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleCloseBottomSheet}
                    className='bg-gray-200 rounded-xl py-3 flex-1 ml-2'
                  >
                    <Text className='text-gray-700 font-medium text-center'>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {/* Additional buttons for saved sessions */}
                {selectedSession?.saved && !selectedSession?.isActive && (
                  <TouchableOpacity 
                    onPress={() => {
                      // Start the saved session
                      if (selectedSession) {
                        const updatedSession = {
                          ...selectedSession, 
                          isActive: true, 
                          saved: false, 
                          startTime: new Date()
                        };
                        setSessions(prev => 
                          prev.map(session => 
                            session.id === selectedSession.id ? updatedSession : session
                          )
                        );
                        setActiveSession(updatedSession);
                        handleCloseBottomSheet();
                      }
                    }}
                    className='flex-row items-center justify-center bg-green-500 rounded-xl py-3 w-full mb-4'
                  >
                    <Ionicons name="play" size={18} color="white" style={{ marginRight: 5 }} />
                    <Text className='text-white font-medium text-center'>
                      Start Session
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Delete Button */}
                <TouchableOpacity 
                  onPress={deleteSession}
                  className='flex-row items-center justify-center bg-red-500 rounded-xl py-3 w-full'
                >
                  <Ionicons name="trash-outline" size={18} color="white" style={{ marginRight: 5 }} />
                  <Text className='text-white font-medium text-center'>
                    Delete Session
                  </Text>
                </TouchableOpacity>
              </View>
            </BottomSheetModal>
          </View>
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

