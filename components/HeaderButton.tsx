import FontAwesome from '@expo/vector-icons/FontAwesome';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';

export const HeaderButton = forwardRef<typeof Pressable, { onPress?: () => void }>(
  ({ onPress }, ref) => {
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? 'white' : 'gray';
    
    return (
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <FontAwesome
            name="info-circle"
            size={25}
            color={iconColor}
            style={[
              styles.headerRight,
              {
                opacity: pressed ? 0.5 : 1,
              },
            ]}
          />
        )}
      </Pressable>
    );
  }
);

export const styles = StyleSheet.create({
  headerRight: {
    marginRight: 15,
  },
});
