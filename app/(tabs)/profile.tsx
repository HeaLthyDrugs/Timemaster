import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to sign out: ' + error.message);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Please log in to view your profile</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.email?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.userId}>User ID: {user.uid}</Text>
      </View>

      <View style={styles.settingsContainer}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
        >
          <Text style={styles.settingLabel}>Edit Profile</Text>
          <Text style={styles.settingAction}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
        >
          <Text style={styles.settingLabel}>Change Password</Text>
          <Text style={styles.settingAction}>›</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => Alert.alert('Coming Soon', 'This feature is under development')}
        >
          <Text style={styles.settingLabel}>Notification Settings</Text>
          <Text style={styles.settingAction}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
  },
  email: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 5,
  },
  userId: {
    fontSize: 14,
    color: '#666',
  },
  settingsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingAction: {
    fontSize: 18,
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 