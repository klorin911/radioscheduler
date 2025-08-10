export interface Dispatcher {
  id: string; // e.g., AYAN
  name: string; // full display name
  badgeNumber?: number; // for seniority calculations
  // Future fields: maxHours, skills, etc.
}

// Extended dispatcher with scheduling preferences
export interface ExtendedDispatcher extends Dispatcher {
  workDays?: string[];
  preferredChannels?: string[];
  preferredTimeBlocks?: string[];
  shift?: string;

  /**
   * Seniority rank (1 = most senior). Typically derived from badgeNumber
   * with lower badge numbers being more senior.
   */
  seniority?: number;

  /**
   * Training configuration
   */
  /** If true, this dispatcher is a trainee (will never be assigned radio/UT). */
  isTrainee?: boolean;
  /** If set, the short ID of their trainer (e.g., "KELL"). */
  traineeOf?: string;
  /** If true, the trainee follows their trainer's work days and shift hours. */
  followTrainerSchedule?: boolean;

  /**
   * If true, scheduler will limit dispatcher to exactly one radio slot per day.
   * If false or undefined, the dispatcher can receive additional radio slots when available.
   */
  minimumRadioOnly?: boolean;

  /**
   * If true, dispatcher is eligible for additional Utility (UT) slots after all
   * dispatchers have received their required single UT for the week.
   */
  wantsExtraUtility?: boolean;

  /**
   * If true, dispatcher will be completely skipped by the auto-scheduler
   * (no radio or UT slots will be assigned automatically).
   */
  excludeFromAutoSchedule?: boolean;
}

// Electron API types
declare global {
  interface Window {
    dispatcherAPI?: {
      getDispatchers: () => Promise<Dispatcher[]>;
      saveDispatchers: (data: Dispatcher[]) => Promise<boolean>;
    };
  }
}

// Utility function for consistent badge number handling
export const extractBadgeNumber = (id: string): number => {
  const match = id.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  // Default fallback - use simple hash of ID for consistent ordering
  return id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10000;
};

export {};
