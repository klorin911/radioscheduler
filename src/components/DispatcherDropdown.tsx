import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ExtendedDispatcher } from '../appTypes';
import { Day, TimeSlot, Column } from '../constants';
import { SHIFT_SLOTS, isEligibleOnDayForSlot } from '../solver/utils/shiftUtils';
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
  disabled?: boolean;
}

const DispatcherDropdown: React.FC<Props> = ({ value, dispatchers, onChange, className, day, timeSlot, column, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingValue, setTypingValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<HTMLDivElement[]>([]);

  // Filter logic (moved earlier so it's available to option builders and handlers)
  const getFilteredDispatchers = useCallback(() => {
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
          // If no day or timeSlot context is provided, default to available
          if (!day || !timeSlot) {
            const wdays = person.followTrainerSchedule && reference ? reference.workDays : person.workDays;
            // No workDays set means available every day
            return !wdays || wdays.length === 0 || (!!day && wdays.includes(day));
          }
          return isEligibleOnDayForSlot(person, day, timeSlot, reference);
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
  }, [typingValue, dispatchers, day, timeSlot, column]);

  // Build a flat list of options (moved earlier; now derives directly from getFilteredDispatchers)
  const getFlatOptions = useCallback(() => {
    type FlatOption = { key: string; label: string; value: string };
    const flat: FlatOption[] = [];
    flat.push({ key: 'none', label: '(None)', value: '' });

    const filtered = getFilteredDispatchers();

    filtered.forEach((dispatcher) => {
      const uniqueKey = `${dispatcher.badgeNumber}-${dispatcher.id}`;
      flat.push({
        key: `d-${uniqueKey}`,
        label: dispatcher.id,
        value: dispatcher.id,
      });

      // Build trainee pairs (skip UT column)
      if (column !== 'UT') {
        let trainees = dispatchers.filter(t => (t.isTrainee === true) && t.traineeOf === dispatcher.id);
        if (typingValue && typingValue.trim()) {
          const st = typingValue.toLowerCase().trim();
          const trainerMatches =
            dispatcher.id.toLowerCase().startsWith(st) ||
            (dispatcher.name || '').toLowerCase().startsWith(st);
          if (!trainerMatches) {
            trainees = trainees.filter(
              t =>
                t.id.toLowerCase().startsWith(st) ||
                (t.name || '').toLowerCase().startsWith(st)
            );
          }
        }
        trainees.forEach((t) => {
          const pairValue = `${dispatcher.id}/${t.id}`;
          const pairDisplay = `${dispatcher.id}/${t.id}`;
          flat.push({
            key: `pair-${uniqueKey}-${t.badgeNumber}-${t.id}`,
            label: pairDisplay,
            value: pairValue,
          });
        });
      }
    });

    return flat;
  }, [dispatchers, typingValue, column, getFilteredDispatchers]);

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
    setHighlightedIndex(null);
  }, [onChange]);

  // Enable typing directly on the button (including when filled)
  const handleButtonKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    // Arrow navigation when open
    if (isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setIsTyping(true);
      setIsOpen(true);
      setHighlightedIndex(prev => {
        const options = getFlatOptions();
        if (options.length === 0) return null;
        const startAt = prev === null ? (options[0]?.label === '(None)' && options.length > 1 ? 1 : 0) : prev;
        const next =
          event.key === 'ArrowDown'
            ? Math.min((startAt ?? 0) + 1, options.length - 1)
            : Math.max((startAt ?? 0) - 1, 0);
        return next;
      });
      return;
    }

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

    // Confirm selection with Enter
    if (event.key === 'Enter') {
      const options = getFlatOptions();
      if (isOpen && highlightedIndex !== null && options[highlightedIndex]) {
        handleSelect(options[highlightedIndex].value);
        event.preventDefault();
        return;
      }
      if (isTyping) {
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
              const trainerKey = trainer.id;
              const traineeKey = match.id;
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
        if (match) handleSelect(match.id);
        event.preventDefault();
        return;
      }
    }

    if (event.key === 'Escape') {
      setIsTyping(false);
      setTypingValue('');
      setIsOpen(false);
      setHighlightedIndex(null);
      event.preventDefault();
    }
  }, [isTyping, typingValue, dispatchers, handleSelect, column, isOpen, highlightedIndex, disabled, getFlatOptions]);

  // When the button is clicked, open the dropdown and focus the hidden input
  // so the user can immediately start typing (no need to press Tab).
  const handleButtonClick = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        // Reset any prior typing buffer and move focus to the hidden input
        setIsTyping(false);
        setTypingValue('');
        // initialize highlight to first dispatcher (skip None)
        const opts = getFlatOptions();
        if (opts.length > 0) {
          setHighlightedIndex(opts[0]?.label === '(None)' && opts.length > 1 ? 1 : 0);
        } else {
          setHighlightedIndex(null);
        }
        setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
        }, 0);
      } else {
        setIsTyping(false);
        setTypingValue('');
        setHighlightedIndex(null);
      }
      return next;
    });
  }, [disabled, getFlatOptions]);

  // Handle keyboard input for typing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Avoid double-handling: skip global handler when keydown originates on our button
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === 'BUTTON' && target.classList.contains('dropdown-button')) {
        return;
      }

      if (dropdownRef.current && dropdownRef.current.contains(document.activeElement)) {
        // Arrow navigation when open
        if (isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          setIsTyping(true);
          setIsOpen(true);
          setHighlightedIndex(prev => {
            const options = getFlatOptions();
            if (options.length === 0) return null;
            const startAt = prev === null ? (options[0]?.label === '(None)' && options.length > 1 ? 1 : 0) : prev;
            const next =
              event.key === 'ArrowDown'
                ? Math.min((startAt ?? 0) + 1, options.length - 1)
                : Math.max((startAt ?? 0) - 1, 0);
            return next;
          });
          return;
        }

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
        } else if (event.key === 'Enter') {
          const options = getFlatOptions();
          if (isOpen && highlightedIndex !== null && options[highlightedIndex]) {
            handleSelect(options[highlightedIndex].value);
            event.preventDefault();
            return;
          }
          if (isTyping) {
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
                  const trainerKey = trainer.id;
                  const traineeKey = match.id;
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
              handleSelect(matchingDispatcher.id);
            }
            event.preventDefault();
          }
        } else if (event.key === 'Escape') {
          setIsTyping(false);
          setTypingValue('');
          setIsOpen(false);
          setHighlightedIndex(null);
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTyping, typingValue, dispatchers, handleSelect, day, timeSlot, column, isOpen, highlightedIndex, getFlatOptions]);

  const getDispatcherByName = (identifier: string) => {
    if (!identifier) return undefined;
    // Support composite values like "TRAINER/TRAINEE" by matching trainer (first part)
    const base = identifier.includes('/') ? identifier.split('/')[0].trim() : identifier;
    // Match by ID or Name explicitly; do not short-circuit on name presence
    return dispatchers.find(d => d.id === base || d.name === base);
  };

  const selectedDispatcher = value ? getDispatcherByName(value) : null;
  const filteredDispatchers = getFilteredDispatchers();

  // Compute effective shift for selected dispatcher (show trainer's shift if trainee follows trainer)
  const selectedEffectiveShift = useMemo(() => {
    if (!selectedDispatcher) return undefined;
    if (selectedDispatcher.isTrainee && selectedDispatcher.followTrainerSchedule && selectedDispatcher.traineeOf) {
      const trainer = dispatchers.find(d => d.id === selectedDispatcher.traineeOf);
      return trainer?.shift || selectedDispatcher.shift;
    }
    return selectedDispatcher.shift;
  }, [selectedDispatcher, dispatchers]);

  // Compute trainee label overlay for trainer selections in radio columns
  const displayLabel = useMemo(() => {
    // While typing, show what the user types
    if (isTyping) return typingValue;

    // If the stored value is composite (e.g., "TRAINER/TRAINEE"), render as ID/ID
    if (value && value.includes('/')) {
      const [a, b] = value.split('/').map((s: string) => s.trim());
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

  // Keep highlighted option scrolled into view
  useEffect(() => {
    if (highlightedIndex === null) return;
    const el = optionRefs.current[highlightedIndex];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // When options list changes (e.g., user types), reset highlight to first valid row
  useEffect(() => {
    if (!isOpen) return;
    const opts = getFlatOptions();
    if (opts.length === 0) {
      setHighlightedIndex(null);
      return;
    }
    // Prefer first non-(None) row if available
    const first = opts[0]?.label === '(None)' && opts.length > 1 ? 1 : 0;
    setHighlightedIndex(first);
  }, [typingValue, filteredDispatchers, isOpen, getFlatOptions]);

  return (
    <div className={`dispatcher-dropdown ${className || ''} ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
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
        <DispatcherTooltip dispatcher={selectedDispatcher} effectiveShift={selectedEffectiveShift}>
          <button
            className={`dropdown-button filled ${disabled ? 'disabled' : ''}`}
            onClick={handleButtonClick}
            onKeyDown={handleButtonKeyDown}
            tabIndex={0}
            disabled={!!disabled}
          >
            {displayLabel}
            <span className="dropdown-arrow">▼</span>
          </button>
        </DispatcherTooltip>
      ) : (
        <button
          className={`dropdown-button ${value ? 'filled' : 'empty'} ${disabled ? 'disabled' : ''}`}
          onClick={handleButtonClick}
          onKeyDown={handleButtonKeyDown}
          tabIndex={0}
          disabled={!!disabled}
        >
          {isTyping ? typingValue : displayLabel}
          <span className="dropdown-arrow">▼</span>
        </button>
      )}

      {/* Dropdown options */}
      {isOpen && !disabled && (
        <div className="dropdown-options">
          {(() => {
            const flat = getFlatOptions();
            if (flat.length === 0) {
              return (
                <div className="dropdown-option disabled">
                  <span>No matches found</span>
                </div>
              );
            }
            return flat.map((opt, idx) => {
              const isSelected = value === opt.value;
              const isHighlighted = highlightedIndex === idx;
              const refCb = (el: HTMLDivElement | null) => {
                if (el) optionRefs.current[idx] = el;
              };
              // Wrap dispatcher rows with tooltip when applicable (not for (None) and not for pairs)
              const baseId = opt.label.includes('/') ? opt.label.split('/')[0] : opt.label;
              const dispatcherForTooltip = dispatchers.find(d => d.id === baseId);

              const content = (
                <div
                  ref={refCb}
                  key={opt.key}
                  className={`dropdown-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                  data-index={idx}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span>{opt.label}</span>
                </div>
              );

              if (dispatcherForTooltip && opt.label !== '(None)' && !opt.label.includes('/')) {
                return (
                  <DispatcherTooltip
                    key={opt.key}
                    dispatcher={dispatcherForTooltip}
                    effectiveShift={
                      dispatcherForTooltip.isTrainee &&
                      dispatcherForTooltip.followTrainerSchedule &&
                      !!dispatcherForTooltip.traineeOf
                        ? (dispatchers.find(d => d.id === dispatcherForTooltip.traineeOf)?.shift || dispatcherForTooltip.shift)
                        : dispatcherForTooltip.shift
                    }
                  >
                    {content}
                  </DispatcherTooltip>
                );
              }
              return content;
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default DispatcherDropdown;
