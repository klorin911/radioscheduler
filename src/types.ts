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
