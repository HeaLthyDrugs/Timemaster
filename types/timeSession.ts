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
}; 