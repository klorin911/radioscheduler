// This file maintains backward compatibility by re-exporting the refactored modules
// The actual implementation has been moved to more focused, modular files

// Re-export types for backward compatibility
export type { ScheduleDay, Assignment } from './solverTypes';

// Re-export main functions for backward compatibility
export { generateScheduleForDay } from './dayScheduler';
export { assignUTSlots } from './utils/utAssignmentUtils';

// Note: The original large glpkScheduler.ts file has been refactored into:
// - ./types.ts - Type definitions
// - ./dayScheduler.ts - Main day scheduling logic
// - ./utils/scheduleUtils.ts - Schedule manipulation utilities
// - ./utils/shiftUtils.ts - Shift-related utilities
// - ./utils/assignmentUtils.ts - Assignment logic utilities
// - ./utils/utAssignmentUtils.ts - UT assignment utilities
// - ./utils/fallbackUtils.ts - Fallback assignment strategies
//
// This modular approach provides:
// - Better separation of concerns
// - Improved testability
// - Easier maintenance
// - Better type safety
// - Performance improvements (no more JSON.parse/stringify for cloning)
