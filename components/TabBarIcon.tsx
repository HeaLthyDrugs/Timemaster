import FontAwesome from '@expo/vector-icons/FontAwesome';
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconType = 'FontAwesome' | 'Feather' | 'AntDesign' | 'Ionicons';

type IconProps = {
  color: string;
  type?: IconType;
} & (
  | { type?: 'FontAwesome'; name: React.ComponentProps<typeof FontAwesome>['name'] }
  | { type: 'Feather'; name: React.ComponentProps<typeof Feather>['name'] }
  | { type: 'AntDesign'; name: React.ComponentProps<typeof AntDesign>['name'] }
  | { type: 'Ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] }
);

export const TabBarIcon = (props: IconProps) => {
  const { name, color, type = 'FontAwesome' } = props;
  
  switch (type) {
    case 'Feather':
      return <Feather name={name as React.ComponentProps<typeof Feather>['name']} size={26} style={styles.tabBarIcon} color={color} />;
    case 'AntDesign':
      return <AntDesign name={name as React.ComponentProps<typeof AntDesign>['name']} size={26} style={styles.tabBarIcon} color={color} />;
    default:
      return <FontAwesome name={name as React.ComponentProps<typeof FontAwesome>['name']} size={26} style={styles.tabBarIcon} color={color} />;
    case 'Ionicons':
      return <Ionicons name={name as React.ComponentProps<typeof Ionicons>['name']} size={26} style={styles.tabBarIcon} color={color} />;
  }
};

export const styles = StyleSheet.create({
  tabBarIcon: {
    marginBottom: -6,
  },
});
