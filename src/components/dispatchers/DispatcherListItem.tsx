import React from 'react';
import { ExtendedDispatcher } from '../../appTypes';

interface Props {
  dispatcher: ExtendedDispatcher;
  isSelected: boolean;
  onSelect: () => void;
}

const DispatcherListItem: React.FC<Props> = ({
  dispatcher,
  isSelected,
  onSelect,
}) => {
  return (
    <div className={`dispatcher-row${isSelected ? ' selected' : ''}`}>
      <div
        className="dispatcher-row-header"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <span className="row-name">{dispatcher.name}</span>
        <span className="row-badge">
          {dispatcher.badgeNumber !== undefined ? `#${dispatcher.badgeNumber}` : ''}
        </span>
      </div>
    </div>
  );
};

export default DispatcherListItem;
