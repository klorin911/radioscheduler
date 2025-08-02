import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExtendedDispatcher } from '../types';
import DispatcherTooltip from './DispatcherTooltip';
import '../styles/dispatcher-dropdown.css';

interface Props {
  value: string;
  dispatchers: ExtendedDispatcher[];
  onChange: (value: string) => void;
  className?: string;
}

const DispatcherDropdown: React.FC<Props> = ({ value, dispatchers, onChange, className }) => {
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

  // Handle keyboard input for typing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
          // Find matching dispatcher and select it
          const searchTerm = typingValue.toLowerCase();
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
  }, [isTyping, typingValue, dispatchers, handleSelect]);

  const getFilteredDispatchers = () => {
    // If no typing value, show all dispatchers
    if (!typingValue || !typingValue.trim()) {
      return dispatchers;
    }
    
    const searchTerm = typingValue.toLowerCase().trim();
    
    const filtered = dispatchers.filter(dispatcher => {
      const dispatcherId = dispatcher.id.toLowerCase();
      const dispatcherName = dispatcher.name ? dispatcher.name.toLowerCase() : '';
      
      // Check if dispatcher ID starts with search term (case insensitive)
      const idStartsWith = dispatcherId.startsWith(searchTerm);
      // Check if dispatcher name starts with search term (case insensitive)
      const nameStartsWith = dispatcherName && dispatcherName.startsWith(searchTerm);
      
      return idStartsWith || nameStartsWith;
    });
    
    return filtered;
  };



  const getDispatcherByName = (name: string) => {
    return dispatchers.find(d => (d.name || d.id) === name);
  };

  const selectedDispatcher = value ? getDispatcherByName(value) : null;
  const filteredDispatchers = getFilteredDispatchers();

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
            tabIndex={0}
          >
            {selectedDispatcher.id}
            <span className="dropdown-arrow">▼</span>
          </button>
        </DispatcherTooltip>
      ) : (
        <button
          className={`dropdown-button ${value ? 'filled' : 'empty'}`}
          onClick={() => setIsOpen(!isOpen)}
          tabIndex={0}
        >
          {isTyping ? typingValue : (value ? (getDispatcherByName(value)?.id || value) : '')}
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
              return (
                <DispatcherTooltip key={uniqueKey} dispatcher={dispatcher}>
                  <div
                    className={`dropdown-option ${value === name ? 'selected' : ''}`}
                    onClick={() => handleSelect(name)}
                  >
                    <span>{dispatcher.id}</span>
                  </div>
                </DispatcherTooltip>
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
