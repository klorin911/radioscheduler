import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ExtendedDispatcher } from '../types';
import { Day, TimeSlot, Column } from '../constants';
import { SHIFT_SLOTS } from '../solver/utils/shiftUtils';
import DispatcherTooltip from './DispatcherTooltip';
import '../styles/dispatcher-dropdown.css';

interface Props {
  value: string;
  dispatchers: ExtendedDispatcher[];
  onChange: (value: string) => void;
  className?: string;
  day?: Day;
  timeSlot?: TimeSlot;
  column?: Column;
}

const DispatcherDropdown: React.FC<Props> = ({ value, dispatchers, onChange, className, day, timeSlot, column }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingValue, setTypingValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setTypingValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((dispatcherName: string) => {
    onChange(dispatcherName);
    setIsOpen(false);
    setIsTyping(false);
    setTypingValue('');
  }, [onChange]);

  // Enable typing directly on the button (including when filled)
  const handleButtonKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Printable keys or Backspace should start/continue typing
    if ((event.key.length === 1) || event.key === 'Backspace') {
      event.preventDefault();
      if (!isTyping) {
        setIsTyping(true);
        setIsOpen(true);
        setTypingValue(event.key === 'Backspace' ? '' : event.key);
      } else {
        setTypingValue(prev => event.key === 'Backspace' ? prev.slice(0, -1) : prev + event.key);
      }
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    // Confirm current typed value
    if (event.key === 'Enter' && isTyping) {
      const searchTerm = typingValue.toLowerCase().trim();
      if (searchTerm && column !== 'UT') {
        // Try trainer/trainee pair first (always offer pairs regardless of day/shift)
        const trainers = dispatchers.filter(d => !(d.isTrainee || d.traineeOf));
        for (const trainer of trainers) {
          const trainees = dispatchers.filter(t => (t.isTrainee === true) && t.traineeOf === trainer.id);
          const match = trainees.find(t => (
            t.id.toLowerCase().startsWith(searchTerm) || (t.name || '').toLowerCase().startsWith(searchTerm)
          ));
          if (match) {
            const trainerKey = trainer.name || trainer.id;
            const traineeKey = match.name || match.id;
            handleSelect(`${trainerKey}/${traineeKey}`);
            event.preventDefault();
            return;
          }
        }
      }

      // Fallback to first matching dispatcher
      const filtered = dispatchers.filter(d =>
        d.id.toLowerCase().startsWith(searchTerm) || (d.name && d.name.toLowerCase().startsWith(searchTerm))
      );
      const match = filtered[0];
      if (match) handleSelect(match.name || match.id);
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      setIsTyping(false);
      setTypingValue('');
      setIsOpen(false);
      event.preventDefault();
    }
  }, [isTyping, typingValue, dispatchers, handleSelect, column]);

  // Handle keyboard input for typing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Avoid double-handling: skip global handler when keydown originates on our button
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === 'BUTTON' && target.classList.contains('dropdown-button')) {
        return;
      }

      if (dropdownRef.current && dropdownRef.current.contains(document.activeElement)) {
        // Check if it's a printable character or backspace
        if ((event.key.length === 1) || event.key === 'Backspace') {
          event.preventDefault();
          
          if (!isTyping) {
            setIsTyping(true);
            setIsOpen(true);
            if (event.key === 'Backspace') {
              setTypingValue('');
            } else {
              setTypingValue(event.key);
            }
          } else {
            // Update typing value manually for better control
            if (event.key === 'Backspace') {
              setTypingValue(prev => prev.slice(0, -1));
            } else {
              setTypingValue(prev => prev + event.key);
            }
          }
          
          // Focus the hidden input to maintain focus
          if (inputRef.current) {
            inputRef.current.focus();
          }
        } else if (event.key === 'Enter' && isTyping) {
          // First, try to match a trainer/trainee pair when searching by trainee
          const searchTerm = typingValue.toLowerCase().trim();
          if (searchTerm && column !== 'UT') {
            // Trainers only (always consider all their trainees)
            const trainers = dispatchers.filter(d => !(d.isTrainee || d.traineeOf));
            for (const trainer of trainers) {
              const trainees = dispatchers.filter(t => (t.isTrainee === true) && t.traineeOf === trainer.id);
              const match = trainees.find(t => (
                t.id.toLowerCase().startsWith(searchTerm) || (t.name || '').toLowerCase().startsWith(searchTerm)
              ));
              if (match) {
                const trainerKey = trainer.name || trainer.id;
                const traineeKey = match.name || match.id;
                handleSelect(`${trainerKey}/${traineeKey}`);
                event.preventDefault();
                return;
              }
            }
          }

          // Fall back to first matching dispatcher (including trainees) by ID or name
          const filteredDispatchers = dispatchers.filter(dispatcher => 
            dispatcher.id.toLowerCase().startsWith(searchTerm) ||
            (dispatcher.name && dispatcher.name.toLowerCase().startsWith(searchTerm))
          );
          const matchingDispatcher = filteredDispatchers[0];
          if (matchingDispatcher) {
            handleSelect(matchingDispatcher.name || matchingDispatcher.id);
          }
          event.preventDefault();
        } else if (event.key === 'Escape') {
          setIsTyping(false);
          setTypingValue('');
          setIsOpen(false);
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTyping, typingValue, dispatchers, handleSelect, day, timeSlot, column]);

  const getFilteredDispatchers = () => {
    // If no typing value, show all dispatchers (trainers and trainees)
    if (!typingValue || !typingValue.trim()) {
      return dispatchers;
    }

    const searchTerm = typingValue.toLowerCase().trim();

    const filtered = dispatchers.filter(dispatcher => {
      const dispatcherId = dispatcher.id.toLowerCase();
      const dispatcherName = dispatcher.name ? dispatcher.name.toLowerCase() : '';

      const idStartsWith = dispatcherId.startsWith(searchTerm);
      const nameStartsWith = dispatcherName && dispatcherName.startsWith(searchTerm);

      // Also include a trainer if any of their present trainees match the search
      let traineeMatches = false;
      if (!dispatcher.isTrainee && !dispatcher.traineeOf && day && timeSlot && column !== 'UT') {
        const trainees = dispatchers.filter(t => (t.isTrainee === true) && t.traineeOf === dispatcher.id);
        const worksOnDay = (person: ExtendedDispatcher, reference?: ExtendedDispatcher): boolean => {
          const days = person.followTrainerSchedule && reference ? reference.workDays : person.workDays;
          return !days || days.length === 0 || days.includes(day);
        };
        const inShift = (person: ExtendedDispatcher, reference?: ExtendedDispatcher): boolean => {
          const effectiveShift = (person.followTrainerSchedule && reference && reference.shift) ? reference.shift : person.shift;
          if (!effectiveShift) return true;
          const slots = SHIFT_SLOTS[effectiveShift] || [];
          return slots.includes(timeSlot);
        };
        traineeMatches = trainees
          .filter(t => worksOnDay(t, dispatcher) && inShift(t, dispatcher))
          .some(t => t.id.toLowerCase().startsWith(searchTerm) || (t.name || '').toLowerCase().startsWith(searchTerm));
      }

      return idStartsWith || nameStartsWith || traineeMatches;
    });

    return filtered;
  };

  const getDispatcherByName = (identifier: string) => {
    if (!identifier) return undefined;
    // Support composite values like "TRAINER/TRAINEE" by matching trainer (first part)
    const base = identifier.includes('/') ? identifier.split('/')[0].trim() : identifier;
    // Match by ID or Name explicitly; do not short-circuit on name presence
    return dispatchers.find(d => d.id === base || d.name === base);
  };

  const selectedDispatcher = value ? getDispatcherByName(value) : null;
  const filteredDispatchers = getFilteredDispatchers();

  // Compute trainee label overlay for trainer selections in radio columns
  const displayLabel = useMemo(() => {
    // While typing, show what the user types
    if (isTyping) return typingValue;

    // If the stored value is composite (e.g., "TRAINER/TRAINEE"), render as ID/ID
    if (value && value.includes('/')) {
      const [a, b] = value.split('/').map(s => s.trim());
      const toId = (part: string) => {
        const d = dispatchers.find(x => (x.id === part || x.name === part));
        return d ? d.id : part;
      };
      if (b) return `${toId(a)}/${toId(b)}`;
      return toId(a);
    }

    // For single selections, always display just the trainer's ID (no automatic overlay)
    if (!selectedDispatcher) return value ? value : '';
    return selectedDispatcher.id;
  }, [selectedDispatcher, isTyping, typingValue, value, dispatchers]);

  return (
    <div className={`dispatcher-dropdown ${className || ''}`} ref={dropdownRef}>
      {/* Hidden input for typing functionality */}
      <input
        ref={inputRef}
        type="text"
        value={typingValue}
        readOnly
        style={{
          position: 'absolute',
          left: '-9999px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />
      
      {/* Current selection - show tooltip only when dropdown is closed */}
      {!isOpen && selectedDispatcher ? (
        <DispatcherTooltip dispatcher={selectedDispatcher}>
          <button
            className="dropdown-button filled"
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={handleButtonKeyDown}
            tabIndex={0}
          >
            {displayLabel}
            <span className="dropdown-arrow">▼</span>
          </button>
        </DispatcherTooltip>
      ) : (
        <button
          className={`dropdown-button ${value ? 'filled' : 'empty'}`}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleButtonKeyDown}
          tabIndex={0}
        >
          {isTyping ? typingValue : displayLabel}
          <span className="dropdown-arrow">▼</span>
        </button>
      )}

      {/* Dropdown options */}
      {isOpen && (
        <div className="dropdown-options">
          <div
            className="dropdown-option"
            onClick={() => handleSelect('')}
          >
            <span>(None)</span>
          </div>
          {filteredDispatchers.length > 0 ? (
            filteredDispatchers.map((dispatcher) => {
              const name = dispatcher.name || dispatcher.id;
              // Use badgeNumber + ID as unique key since names can be duplicated
              const uniqueKey = `${dispatcher.badgeNumber}-${dispatcher.id}`;

              // Helper to compute trainee list for this trainer (always offer pairs; exclude UT)
              const presentTrainees = (() => {
                if (column === 'UT') return [] as ExtendedDispatcher[];
                let pts = dispatchers.filter(t => (t.isTrainee === true) && t.traineeOf === dispatcher.id);
                // When searching, only show trainee pairs that match the query
                if (typingValue && typingValue.trim()) {
                  const st = typingValue.toLowerCase().trim();
                  pts = pts.filter(t => t.id.toLowerCase().startsWith(st) || (t.name || '').toLowerCase().startsWith(st));
                }
                return pts;
              })();

              return (
                <React.Fragment key={uniqueKey}>
                  <DispatcherTooltip dispatcher={dispatcher}>
                    <div
                      className={`dropdown-option ${value === name ? 'selected' : ''}`}
                      onClick={() => handleSelect(name)}
                    >
                      <span>{dispatcher.id}</span>
                    </div>
                  </DispatcherTooltip>

                  {/* Trainer-with-trainee options (one per present trainee) */}
                  {presentTrainees.map((t) => {
                    const traineeLabelId = t.id;
                    const pairValue = `${name}/${t.name || t.id}`; // store as names when available
                    const pairDisplay = `${dispatcher.id}/${traineeLabelId}`; // show IDs in UI
                    const pairKey = `${uniqueKey}-pair-${t.badgeNumber}-${t.id}`;
                    return (
                      <div
                        key={pairKey}
                        className={`dropdown-option ${value === pairValue ? 'selected' : ''}`}
                        onClick={() => handleSelect(pairValue)}
                      >
                        <span>{pairDisplay}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })
          ) : isTyping && typingValue.trim() && (
            <div className="dropdown-option disabled">
              <span>No matches found</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DispatcherDropdown;
