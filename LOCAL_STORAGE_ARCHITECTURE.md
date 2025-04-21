# TimeMaster v2 - Local Storage Architecture

TimeMaster v2 uses a local-first architecture for storing and managing time tracking data. This document explains how data is stored and managed in the app.

## Data Structure

The core data structure of the app is the `TimeSession`:

```typescript
export type TimeSession = {
  id: string;             // Unique identifier for the session
  category: string;       // Main category of the time session
  subCategory: string;    // Subcategory for more detailed categorization
  title: string;          // Title/description of the session
  startTime: Date;        // When the session started
  endTime?: Date;         // When the session ended (if completed)
  isActive: boolean;      // Whether the session is currently running
  saved?: boolean;        // Whether the session has been explicitly saved
  elapsedTime?: number;   // Total elapsed time in milliseconds
  
  // Status fields
  syncStatus?: 'saved' | 'unsaved' | 'synced'; // Local status
  updatedAt?: Date;       // Last time the session was updated
  userId?: string;        // User ID for multi-user support
  deleted?: boolean;      // Flag to mark sessions for deletion
};
```

## Storage Implementation

All session data is stored using `AsyncStorage` with a user-specific key to ensure data isolation between users:

```javascript
const getStorageKey = (userId: string) => `time_sessions_${userId}`;
```

This approach allows the app to:
- Support multiple user profiles on a single device
- Maintain backwards compatibility with previous versions
- Efficiently query and update session data

## Data Management

### Session Operations

The app provides these core operations for managing sessions:

1. **Creating a session**: Generates a new session with a unique ID and saves it to storage
2. **Updating a session**: Modifies an existing session's properties and updates storage
3. **Deleting a session**: Marks a session for deletion (soft delete) and eventually removes it from storage
4. **Querying sessions**: Retrieves sessions with filtering options for analysis and display

### Offline First

Since TimeMaster is a local-only app, all operations are performed directly on the device storage without requiring network connectivity. This ensures:

- Fast performance
- Complete privacy of user data
- Ability to work in any environment without internet connection

## Working with the Local Storage API

### Managing Sessions

The app provides a `useSessionManager` hook for managing sessions:

```javascript
const { 
  sessions,
  activeSession,
  isLoading,
  startSession,
  stopSession,
  saveSessionUpdates,
  deleteSession
} = useSessionManager();
```

### Data Persistence

Sessions are automatically persisted to AsyncStorage whenever changes occur. The app uses a combination of:

- Immediate storage updates for critical operations (starting/stopping sessions)
- Debounced updates for less critical changes to minimize I/O operations

## Authentication

User authentication is also handled locally without requiring external services:

1. **User Registration**: Creates a new user profile stored locally on the device
2. **Login**: Authenticates against locally stored credentials
3. **User Data**: Each user has isolated storage for their time sessions

## Migrating from Previous Versions

If you previously used the Firebase-connected version of TimeMaster, this version will automatically migrate your existing data to the local-only storage format when you first sign in with your credentials.

## Best Practices

When working with the local storage architecture:

1. **Use the provided hooks**: Avoid direct AsyncStorage manipulation
2. **Handle loading states**: Check the `isLoading` flag before accessing session data
3. **Preserve user context**: All session operations require a valid user ID
4. **Respect data structure**: Follow the `TimeSession` type definition for consistency

## Data Backup

Since all data is stored locally, it's important to implement a backup strategy:

1. **Export/Import**: The app includes functionality to export sessions as JSON
2. **Automatic Backups**: Sessions are automatically backed up to local storage
3. **Device Backups**: Ensure your device backup settings include app data

## Performance Considerations

Local storage operations are generally fast, but consider these practices for optimal performance:

1. **Batch Updates**: When making multiple changes, batch them together
2. **Paginated Queries**: For users with many sessions, implement pagination
3. **Cleanup**: Periodically remove fully deleted sessions to free up storage

---

For more details on implementation, refer to the source code in the `services` and `hooks` directories. 