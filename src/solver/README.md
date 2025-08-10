# Radio Scheduler Solver - Refactored Architecture

This directory contains the refactored radio scheduling system, which has been broken down into focused, modular components for better maintainability, testability, and performance.

## Architecture Overview

The original monolithic `glpkScheduler.ts` file has been refactored into the following modules:

### Core Files

- **`types.ts`** - Shared type definitions and interfaces
- **`dayScheduler.ts`** - Main day scheduling logic
- **`weekScheduler.ts`** - Weekly scheduling orchestration
- **`glpkScheduler.ts`** - Backward compatibility exports

### Utility Modules (`utils/`)

- **`scheduleUtils.ts`** - Schedule manipulation and validation utilities
- **`shiftUtils.ts`** - Shift-related logic and utilities
- **`assignmentUtils.ts`** - Assignment algorithms and dispatcher processing
- **`utAssignmentUtils.ts`** - UT (utility) slot assignment logic
- **`fallbackUtils.ts`** - Fallback assignment strategies

## Key Improvements

### 1. **Performance Enhancements**
- Replaced `JSON.parse(JSON.stringify())` with proper cloning functions
- Reduced memory allocations and garbage collection pressure
- Optimized nested loops and data structures

### 2. **Type Safety**
- Comprehensive TypeScript interfaces and types
- Result types for better error handling
- Eliminated `any` types and improved type inference

### 3. **Code Organization**
- Single Responsibility Principle - each module has a focused purpose
- Clear separation of concerns
- Improved readability and maintainability

### 4. **Error Handling**
- `OperationResult<T>` interface for consistent error handling
- `AssignmentResult` for detailed assignment feedback
- Proper validation and error messages

### 5. **Testability**
- Small, focused functions that are easy to unit test
- Pure functions separated from side effects
- Dependency injection ready

## Usage Examples

### Basic Day Scheduling

```typescript
import { generateScheduleForDay } from './dayScheduler';
import { ExtendedDispatcher } from '../types';
import { Day } from '../constants';

const dispatchers: ExtendedDispatcher[] = [
  // ... your dispatchers
];

const schedule = await generateScheduleForDay('Monday' as Day, dispatchers);
```

### Weekly Scheduling

```typescript
import { generateWeeklySchedule } from './weekScheduler';

const weeklySchedule = await generateWeeklySchedule(currentSchedule, dispatchers);
```

### Using Utilities

```typescript
import { cloneScheduleDay, hasAnyAssignments } from './utils/scheduleUtils';
import { getEligibleSlots } from './utils/shiftUtils';
import { prepareDispatchers } from './utils/assignmentUtils';

// Clone a schedule day
const clonedDay = cloneScheduleDay(originalDay);

// Check if day has assignments
const hasAssignments = hasAnyAssignments(day);

// Get eligible slots for a dispatcher
const eligibleSlots = getEligibleSlots(dispatcher);

// Prepare dispatchers for scheduling
const sortedDispatchers = prepareDispatchers(dispatchers, 'Monday');
```

## Migration Guide

### For Existing Code

The refactoring maintains backward compatibility through `glpkScheduler.ts`. Existing imports should continue to work:

```typescript
// This still works
import { generateScheduleForDay, ScheduleDay, assignUTSlots } from './glpkScheduler';
```

### For New Code

Use the new modular imports for better tree-shaking and clearer dependencies:

```typescript
// Preferred for new code
import { generateScheduleForDay } from './dayScheduler';
import { ScheduleDay } from './types';
import { assignUTSlots } from './utils/utAssignmentUtils';
```

## Function Reference

### Core Functions

#### `generateScheduleForDay(day, dispatchers, locked?)`
- **Purpose**: Generate a schedule for a single day
- **Parameters**:
  - `day`: Day of the week
  - `dispatchers`: Array of available dispatchers
  - `locked?`: Optional existing schedule to merge with
- **Returns**: `Promise<ScheduleDay>`

#### `generateWeeklySchedule(current, dispatchers)`
- **Purpose**: Generate a complete weekly schedule
- **Parameters**:
  - `current`: Current weekly schedule
  - `dispatchers`: Array of dispatchers
- **Returns**: `Promise<Schedule>`

### Utility Functions

#### Schedule Utils
- `cloneScheduleDay(day)` - Deep clone a schedule day
- `createEmptyScheduleDay()` - Create empty schedule structure
- `hasAnyAssignments(day)` - Check if day has any assignments
- `mergeScheduleDays(base, overlay)` - Merge two schedule days
- `validateScheduleDay(day)` - Validate schedule structure

#### Shift Utils
- `getEligibleSlots(dispatcher)` - Get time slots for dispatcher's shift
- `isSlotInShift(dispatcher, slot)` - Check if slot is in dispatcher's shift
- `getShiftsForSlot(slot)` - Get all shifts that include a time slot

#### Assignment Utils
- `prepareDispatchers(dispatchers, day)` - Filter and sort dispatchers
- `assignMinimumSlot(dispatcher, schedule, day)` - Assign minimum required slot
- `assignPreferredSlot(dispatcher, schedule, day)` - Assign based on preferences
- `assignExtraRadioSlot(dispatcher, schedule, day)` - Assign extra radio slots

## Configuration

### Scheduling Rules

The system follows these rules in order:

1. **Seniority**: Lower badge numbers get priority
2. **Shift Restrictions**: Dispatchers assigned within their shift hours when possible
3. **Preferences**: Channel and time block preferences are respected
4. **Minimum Assignment**: Every dispatcher gets at least one slot per day
5. **Extra Radio**: Dispatchers can opt for additional radio slots
6. **UT Assignment**: Exactly one UT slot per dispatcher per week

### Fallback Strategies

When primary scheduling fails, the system uses fallback strategies:

- **Round Robin**: Simple rotation through available dispatchers
- **Shift Aware**: Respects shift preferences (TODO)
- **Weighted**: Based on preferences and seniority (TODO)

## Testing

Each module can be tested independently:

```typescript
// Example test structure
describe('scheduleUtils', () => {
  describe('cloneScheduleDay', () => {
    it('should create a deep copy', () => {
      // Test implementation
    });
  });
});
```

## Future Enhancements

### Planned Improvements

1. **Algorithm Optimization**: Implement more sophisticated assignment algorithms
2. **Caching**: Add memoization for expensive operations
3. **Metrics**: Add performance and assignment quality metrics
4. **Configuration**: Make scheduling rules configurable
5. **Validation**: Add comprehensive input validation
6. **Logging**: Implement structured logging with levels

### Extension Points

The modular architecture makes it easy to:

- Add new assignment strategies
- Implement different fallback mechanisms
- Add new validation rules
- Integrate with external scheduling systems
- Add performance monitoring

## Contributing

When adding new features:

1. Follow the single responsibility principle
2. Add comprehensive TypeScript types
3. Include proper error handling
4. Write unit tests
5. Update this documentation

## Performance Notes

The refactored system provides significant performance improvements:

- **Memory**: Reduced memory usage through proper cloning
- **CPU**: Optimized algorithms and reduced complexity
- **Maintainability**: Easier to profile and optimize individual components
- **Scalability**: Better suited for larger dispatcher pools and complex schedules
