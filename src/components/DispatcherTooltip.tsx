import React, { useState, useRef, useEffect } from 'react';
import { ExtendedDispatcher } from '../solver/glpkScheduler';
import '../styles/tooltip.css';

interface Props {
  dispatcher: ExtendedDispatcher;
  children: React.ReactNode;
}

const DispatcherTooltip: React.FC<Props> = ({ dispatcher, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const formatList = (items: string[] | undefined, fallback = 'Any') => {
    if (!items || items.length === 0) return fallback;
    return items.join(', ');
  };

  return (
    <div
      ref={containerRef}
      className="dispatcher-tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className="dispatcher-tooltip"
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000
          }}
        >
          <div className="tooltip-header">
            <strong>{dispatcher.name || dispatcher.id}</strong>
          </div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Work Days:</span>
              <span className="tooltip-value">{formatList(dispatcher.workDays, 'All days')}</span>
            </div>
            {dispatcher.shift && (
              <div className="tooltip-row">
                <span className="tooltip-label">Shift:</span>
                <span className="tooltip-value">{dispatcher.shift}</span>
              </div>
            )}
            <div className="tooltip-row">
              <span className="tooltip-label">Preferred Channels:</span>
              <span className="tooltip-value">{formatList(dispatcher.preferredChannels)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Preferred Times:</span>
              <span className="tooltip-value">{formatList(dispatcher.preferredTimeBlocks)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatcherTooltip;
