import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useColorScheme } from 'nativewind';
import { Stack, useRouter } from 'expo-router';
import { ThemeToggle } from '~/components/ThemeToggle';

export default function Modal() {
  const [activeTab, setActiveTab] = useState<'settings' | 'profile'>('settings');
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fafaff', paddingTop: 60 }]}>
      <Stack.Screen 
        options={{
          title: '',
          headerStyle: {
            backgroundColor: isDark ? '#000' : '#fafaff',
          },
          headerTintColor: isDark ? '#fff' : '#000',
          headerShadowVisible: false,
          headerTransparent: true
        }}
      />
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'settings' && styles.activeTab,
            activeTab === 'settings' && isDark && styles.activeTabDark
          ]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons name="settings-outline" size={22} color={activeTab === 'settings' ? (isDark ? '#fff' : '#000') : '#888'} />
          <Text style={[
            styles.tabText, 
            activeTab === 'settings' ? (isDark ? styles.activeTextDark : styles.activeText) : styles.inactiveText
          ]}>
            Settings
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'profile' && styles.activeTab,
            activeTab === 'profile' && isDark && styles.activeTabDark
          ]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons name="person-outline" size={22} color={activeTab === 'profile' ? (isDark ? '#fff' : '#000') : '#888'} />
          <Text style={[
            styles.tabText, 
            activeTab === 'profile' ? (isDark ? styles.activeTextDark : styles.activeText) : styles.inactiveText
          ]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Settings Content */}
      {activeTab === 'settings' && (
        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>App Settings</Text>
            
            <View style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Theme</Text>
              <ThemeToggle />
            </View>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Notifications</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Data Backup</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => router.push('/onboarding' as any)}
            >
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Show Onboarding</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>About</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>App Version</Text>
              <Text style={[styles.versionText, { color: isDark ? '#888' : '#666' }]}>1.0.0</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Privacy Policy</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Terms of Service</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Profile Content */}
      {activeTab === 'profile' && (
        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>U</Text>
              </View>
              <Text style={[styles.email, { color: isDark ? '#fff' : '#000' }]}>Local User</Text>
              <Text style={styles.userId}>App running in local-only mode</Text>
            </View>
          </View>
          
          <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1c' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>Usage Information</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>App Statistics</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Data Management</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Export Data</Text>
              <Text style={styles.settingAction}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginVertical: 16,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  activeTabDark: {
    backgroundColor: '#2c2c2c',
  },
  tabText: {
    marginLeft: 6,
    fontWeight: '500',
  },
  activeText: {
    color: '#000',
  },
  activeTextDark: {
    color: '#fff',
  },
  inactiveText: {
    color: '#888',
  },
  content: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingLabel: {
    fontSize: 16,
  },
  settingAction: {
    fontSize: 18,
    color: '#888',
  },
  versionText: {
    fontSize: 14,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    color: '#888',
  },
});
