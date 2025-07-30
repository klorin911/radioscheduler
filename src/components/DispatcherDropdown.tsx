import React, { useState, useRef, useEffect } from 'react';
import { ExtendedDispatcher } from '../solver/glpkScheduler';
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
  const [hoveredDispatcher, setHoveredDispatcher] = useState<ExtendedDispatcher | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (dispatcherName: string) => {
    onChange(dispatcherName);
    setIsOpen(false);
    setHoveredDispatcher(null);
  };

  const getDispatcherByName = (name: string) => {
    return dispatchers.find(d => (d.name || d.id) === name);
  };

  const selectedDispatcher = value ? getDispatcherByName(value) : null;

  return (
    <div className={`dispatcher-dropdown ${className || ''}`} ref={dropdownRef}>
      {/* Current selection - show tooltip only when dropdown is closed */}
      {!isOpen && selectedDispatcher ? (
        <DispatcherTooltip dispatcher={selectedDispatcher}>
          <button
            className="dropdown-button filled"
            onClick={() => setIsOpen(!isOpen)}
          >
            {value}
            <span className="dropdown-arrow">▼</span>
          </button>
        </DispatcherTooltip>
      ) : (
        <button
          className={`dropdown-button ${value ? 'filled' : 'empty'}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {value || ''}
          <span className="dropdown-arrow">▼</span>
        </button>
      )}

      {/* Dropdown options */}
      {isOpen && (
        <div className="dropdown-options">
          <div
            className="dropdown-option"
            onClick={() => handleSelect('')}
            onMouseEnter={() => setHoveredDispatcher(null)}
          >
            <span>(None)</span>
          </div>
          {dispatchers.map((dispatcher) => {
            const name = dispatcher.name || dispatcher.id;
            return (
              <DispatcherTooltip key={name} dispatcher={dispatcher}>
                <div
                  className={`dropdown-option ${value === name ? 'selected' : ''}`}
                  onClick={() => handleSelect(name)}
                  onMouseEnter={() => setHoveredDispatcher(dispatcher)}
                  onMouseLeave={() => setHoveredDispatcher(null)}
                >
                  <span>{name}</span>
                </div>
              </DispatcherTooltip>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DispatcherDropdown;
