import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContent } from '~/components/ScreenContent';
import { TrackingCard } from '~/components/TrackingCard';

export default function Analysis() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  
  // These would come from your actual tracking data
  const clarityTime = "1h 30m";
  const mindTime = "45m";
  const bodyTime = "2h 15m";
  
  // Pastel colors for the cards
  const cardColors = {
    clarity: colorScheme === 'dark' ? 'rgba(160, 210, 255, 0.15)' : 'rgba(160, 210, 255, 0.3)',
    mind: colorScheme === 'dark' ? 'rgba(255, 191, 200, 0.15)' : 'rgba(255, 191, 200, 0.3)',
    body: colorScheme === 'dark' ? 'rgba(187, 255, 204, 0.15)' : 'rgba(187, 255, 204, 0.3)',
  };
  return (
    <>
    <View className='flex-1 p-4 bg-white dark:bg-black'>
      <Text
        className="text-sm text-gray-400 mb-3"
      >
        Today's Summary
      </Text>

       {/* Bento Layout for Cards */}
       <View className="flex-row mb-2">
            {/* Clarity Card - Takes full width */}
            <TrackingCard
              title="Clarity"
              time={clarityTime}
              description="Focus & Deep Work"
              backgroundColor={cardColors.clarity}
              delay={100}
            />
          </View>
          
          <View className="flex-row">
            {/* Mind Card */}
            <TrackingCard
              title="Mind"
              time={mindTime}
              description="Learning & Growth"
              backgroundColor={cardColors.mind}
              delay={200}
              className="mr-2"
            />
            
            {/* Body Card */}
            <TrackingCard
              title="Body"
              time={bodyTime}
              description="Health & Fitness"
              backgroundColor={cardColors.body}
              delay={300}
            />
          </View>
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
