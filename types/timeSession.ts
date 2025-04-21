export type SyncStatus = 'saved' | 'unsaved' | 'synced';

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
  
  // Status related fields
  syncStatus?: SyncStatus;
  updatedAt?: Date;
  userId?: string; // To ensure sessions are scoped to the right user
  deleted?: boolean; // Flag to mark sessions for deletion
}; 