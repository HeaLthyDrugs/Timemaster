import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

type NetworkContextType = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
};

const NetworkContext = createContext<NetworkContextType>({
  isConnected: null,
  isInternetReachable: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState<Date | null>(null);

  useEffect(() => {
    let unsubscribe: NetInfoSubscription | null = null;

    const setupNetInfo = async () => {
      try {
        // Get the initial network state
        const state = await NetInfo.fetch();
        updateNetworkStatus(state);

        // Subscribe to network state updates
        unsubscribe = NetInfo.addEventListener(updateNetworkStatus);
        
        console.log("Network monitoring initialized successfully");
      } catch (error) {
        console.error("Error setting up network monitoring:", error);
        // Fallback to assume we're online to prevent blocking app functionality
        setIsConnected(true);
        setIsInternetReachable(true);
      }
    };

    setupNetInfo();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Handle network status changes
  const updateNetworkStatus = (state: NetInfoState) => {
    const wasConnected = isConnected;
    const newIsConnected = state.isConnected;
    
    console.log("Network status changed:", state);
    
    setIsConnected(newIsConnected);
    setIsInternetReachable(state.isInternetReachable);

    // Track connection/disconnection times for diagnostics and sync
    if (newIsConnected && !wasConnected) {
      setLastConnectedAt(new Date());
    } else if (!newIsConnected && wasConnected) {
      setLastDisconnectedAt(new Date());
    }
  };

  return (
    <NetworkContext.Provider 
      value={{ 
        isConnected, 
        isInternetReachable, 
        lastConnectedAt, 
        lastDisconnectedAt 
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}; 