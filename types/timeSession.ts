export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflicted';

export type TimeSession = {
  id: string;
  category: string;
  subCategory: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  saved?: boolean;
  elapsedTime?: number; // Total elapsed time in milliseconds
  
  // Sync related fields
  syncStatus?: SyncStatus;
  updatedAt?: Date;
  syncedAt?: Date;
  userId?: string; // To ensure sessions are scoped to the right user
  localId?: string; // Used to track local version of remote sessions
  firebaseId?: string; // Firebase document ID if different from id
  lastSyncAttempt?: Date; // Used for retry mechanism
  syncRetryCount?: number; // For exponential backoff
  deleted?: boolean; // Flag to mark sessions for deletion
}; 