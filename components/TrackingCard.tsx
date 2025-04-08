import { View, Text, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from '~/lib/useColorScheme';

type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type FontAwesomeIconName = React.ComponentProps<typeof FontAwesome5>['name'];

interface TrackingCardProps {
  title: string;
  time: string;
  description: string;
  backgroundColor: string;
  iconName?: string;
  delay?: number;
  className?: string;
}

export function TrackingCard({
  title,
  time,
  description,
  backgroundColor,
  iconName,
  delay = 100,
  className = '',
}: TrackingCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Icon colors based on title (for semantic meaning)
  const getIconColor = () => {
    switch (title.toLowerCase()) {
      case 'clarity':
        return isDark ? '#A0D2FF' : '#1E3A8A';
      case 'mind':
        return isDark ? '#FFBFC8' : '#9D174D';
      case 'body':
        return isDark ? '#BBFFCC' : '#065F46';
      default:
        return isDark ? '#FFFFFF' : '#000000';
    }
  };
  
  // Get appropriate icon based on title
  const getIconName = (): FontAwesomeIconName => {
    switch (title.toLowerCase()) {
      case 'clarity':
        return 'brain';
      case 'mind':
        return 'book';
      case 'body':
        return 'running';
      default:
        return 'clock';
    }
  };
  
  // Platform-specific shadows
  const shadowStyle = Platform.select({
    ios: {
      shadowColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {},
  });
  
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      className={`flex-1 rounded-3xl p-4 ${className}`}
      style={{
        backgroundColor,
      }}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="text-sm dark:text-gray-300"
          style={{ color: getIconColor(), opacity: 0.5 }}
        >
          {title}
        </Text>
        
        <View className="w-8 h-8 items-center justify-center">
          <FontAwesome5 
            name={getIconName()} 
            size={18} 
            color={getIconColor()} 
            style={{ opacity: 0.5 }}
          />
        </View>
      </View>
      
      <Text
        className="text-3xl text-black dark:text-white"
        style={{ opacity: 0.8 }}
      >
        {time}
      </Text>
      <Text
        className="text-xs text-gray-500 dark:text-gray-300 mt-1"
        style={{ opacity: 0.5 }}
      >
        {description}
      </Text>
    </Animated.View>
  );
} 