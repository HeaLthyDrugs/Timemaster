import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Stack, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInAnonymously, forgotPassword } = useAuth();

  // Log Google Sign-In configuration on component mount
  useEffect(() => {
    const checkGoogleConfig = async () => {
      try {
        console.log('Checking Google Sign-In configuration...');
        const config = await GoogleSignin.getTokens();
        console.log('Google Sign-In configured correctly, tokens available');
      } catch (error: any) {
        console.log('Google Sign-In not configured or user not signed in:', error);
      }

      // Check Play Services
      try {
        const playServicesAvailable = await GoogleSignin.hasPlayServices();
        console.log('Google Play Services available:', playServicesAvailable);
      } catch (error: any) {
        console.error('Google Play Services check error:', error);
      }
    };

    checkGoogleConfig();
  }, []);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      Alert.alert('Authentication Error', error.message);
    } finally {
      setLoading(false);
      setIsEmailModalVisible(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log('Google auth button pressed');
    setLoading(true);
    try {
      console.log('Calling signInWithGoogle()');
      await signInWithGoogle();
      console.log('Google sign in completed successfully');
    } catch (error: any) {
      console.error('Google auth error in login screen:', error);
      // Error is already handled in the AuthContext, but we can add additional handling here if needed
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousAuth = async () => {
    console.log('Anonymous auth button pressed');
    setLoading(true);
    try {
      await signInAnonymously();
      console.log('Anonymous sign in completed successfully');
    } catch (error: any) {
      console.error('Anonymous auth error:', error);
      Alert.alert('Anonymous Authentication Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      console.log('Forgot password requested for:', email);
      await forgotPassword(email);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.');
    } catch (error: any) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Login',
          headerShown: false,
        }}
      />
      
      {/* Main Login Screen */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>TimeMaster</Text>
          <Text style={styles.subtitle}>Track your time efficiently</Text>
        </View>

        <View style={styles.authOptions}>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => {
              console.log('Email auth button pressed');
              setIsEmailModalVisible(true);
            }}
            disabled={loading}
          >
            <Ionicons name="mail-outline" size={24} color="#333" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Continue with Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.authButton}
            onPress={handleGoogleAuth}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={24} color="#333" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.authButton}
            onPress={handleAnonymousAuth}
            disabled={loading}
          >
            <Ionicons name="person-outline" size={24} color="#333" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Continue Anonymously</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}
      </View>

      {/* Email Authentication Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEmailModalVisible}
        onRequestClose={() => setIsEmailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              <Pressable onPress={() => setIsEmailModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color="#333" />
              </Pressable>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.modalActions}>
              {!isSignUp && (
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleEmailAuth}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => setIsSignUp(!isSignUp)}
              >
                <Text style={styles.switchModeText}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  authOptions: {
    gap: 15,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  modalActions: {
    marginTop: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#2196F3',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchMode: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#2196F3',
    fontSize: 16,
  },
  debugInfo: {
    marginTop: 40,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugButton: {
    backgroundColor: '#ff9800',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  debugButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 5,
  }
}); 