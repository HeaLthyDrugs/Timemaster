import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface TimeCardProps {
  time: string;
  projectName?: string;
  onTimeChange?: (time: string) => void;
  onPress?: () => void;
}

export default function TimeCard({ 
  time, 
  projectName = "Rasion Project",
  onTimeChange,
  onPress 
}: TimeCardProps) {
  return (
    <TouchableOpacity 
      onPress={onPress}
      className='bg-black dark:bg-black p-6 rounded-3xl mb-3'
    >
      <View className='flex-row items-center justify-between'>
        <Text className='text-white text-3xl font-bold'>{time}</Text>
        <MaterialIcons name="chevron-right" size={24} color="white" />
      </View>
      
      <View className='flex-row items-center mt-2'>
        <View className='w-2 h-2 rounded-full bg-purple-500 mr-2' />
        <Text className='text-white text-sm'>{projectName}</Text>
      </View>
    </TouchableOpacity>
  );
}
