import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

interface TimeCardProps {
  time: string;
  projectName?: string;
  onTimeChange?: (time: string) => void;
  onPress?: () => void;
  category?: string;
  backgroundColor?: string;
  textColor?: string;
  isActive?: boolean;
}

// Function to format time display based on seconds
function formatTimeDisplay(timeString: string): string {
  // If time is already in the format "1h 32m 54s"
  if (timeString.includes('h') || timeString.includes('m') || timeString.includes('s')) {
    return timeString;
  }
  
  // Try to parse the time as seconds
  const totalSeconds = parseInt(timeString, 10);
  if (isNaN(totalSeconds)) {
    return timeString; // Return as is if parsing fails
  }
  
  // Calculate hours, minutes, seconds
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

// Get icon based on category
function getCategoryIcon(category?: string): string {
  switch (category) {
    case 'Goal':
      return 'brain';
    case 'Health':
      return 'running';
    case 'Lost':
      return 'hourglass-half';
    default:
      return 'clock';
  }
}

export default function TimeCard({ 
  time, 
  projectName = "No active session",
  onTimeChange,
  onPress,
  category,
  backgroundColor = 'black',
  textColor = 'white',
  isActive = false
}: TimeCardProps) {
  const formattedTime = formatTimeDisplay(time);
  const icon = getCategoryIcon(category);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Run entry animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    // Start pulse animation for active timer
    if (isActive) {
      // startPulseAnimation();
    }
    
    return () => {
      // Clean up animations
      pulseAnim.stopAnimation();
    };
  }, []);
  
  // When active state changes, adjust pulse animation
  useEffect(() => {
    if (isActive) {
      // startPulseAnimation();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isActive]);

  // Gentle pulsing effect for active timers
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { scale: isActive ? pulseAnim : 1 }
          ]
        },
        styles.cardWrapper
      ]}
    >
      <TouchableOpacity 
        onPress={onPress}
        style={[
          styles.container,
          { backgroundColor }
        ]}
        className='p-6 rounded-3xl'
        activeOpacity={0.9}
      >
        <View style={{ position: 'relative' }}>
          {/* Time and project info */}
          <View>
            <Text style={{ color: textColor }} className='text-4xl font-bold'>{formattedTime}</Text>
            
            <View className='flex-row items-center mt-2'>
              <View style={{ backgroundColor: textColor }} className='w-2 h-2 rounded-full mr-2' />
              <Text style={{ color: textColor }} className='text-sm'>{projectName}</Text>
              {category ? (
                <Text style={{ color: textColor, opacity: 0.7 }} className='text-xs ml-2'>
                  ({category})
                </Text>
              ) : null}
            </View>
          </View>

          
          {/* Category icon in bottom right */}
          <View style={styles.iconContainer}>
            <FontAwesome5 name={icon} size={22} color={textColor} style={{ opacity: 0.4 }} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 8,
  },
  container: {
    backgroundColor: 'black',
  },
  arrowContainer: {
    position: 'absolute',
    top: 12,
    right: 0,
  },
  iconContainer: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    height: 24,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
