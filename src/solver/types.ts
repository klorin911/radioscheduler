import { TimeSlot, Column } from '../constants';

/**
 * Represents a single day's schedule with all time slots and columns
 */
export type ScheduleDay = Record<TimeSlot, Record<Column, string>>;

/**
 * Assignment interface for better type safety
 */
export interface Assignment {
  slot: TimeSlot;
  col: Column;
  priority: number;
}

/**
 * Result type for operations that can succeed or fail
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Assignment result with additional metadata
 */
export interface AssignmentResult extends OperationResult {
  assignment?: Assignment;
  dispatcherKey?: string;
}
