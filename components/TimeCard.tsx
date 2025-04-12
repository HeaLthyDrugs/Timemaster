import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface TimeCardProps {
  time: string;
  projectName?: string;
  onTimeChange?: (time: string) => void;
  onPress?: () => void;
  category?: string;
  backgroundColor?: string;
  textColor?: string;
}

export default function TimeCard({ 
  time, 
  projectName = "No active session",
  onTimeChange,
  onPress,
  category,
  backgroundColor = 'black',
  textColor = 'white'
}: TimeCardProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: backgroundColor }
      ]}
      className='p-6 rounded-3xl mb-3'
    >
      <View className='flex-row items-center justify-between'>
        <Text style={{ color: textColor }} className='text-3xl font-bold'>{time}</Text>
        <MaterialIcons name="chevron-right" size={24} color={textColor} />
      </View>
      
      <View className='flex-row items-center mt-2'>
        <View style={{ backgroundColor: textColor }} className='w-2 h-2 rounded-full mr-2' />
        <Text style={{ color: textColor }} className='text-sm'>{projectName}</Text>
        {category ? (
          <Text style={{ color: textColor, opacity: 0.7 }} className='text-xs ml-2'>
            ({category})
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'black',
  },
});
