import React from 'react';
import { ExtendedDispatcher } from '../../appTypes';

interface Props {
  dispatcher: ExtendedDispatcher;
  onUpdate: <K extends keyof ExtendedDispatcher>(field: K, value: ExtendedDispatcher[K]) => void;
  onRemove: () => void;
}

const shiftOptions = [
  { value: 'A', label: 'A (0300-1330)' },
  { value: 'B', label: 'B (0700-1730)' },
  { value: 'C', label: 'C (1100-2130)' },
  { value: 'D', label: 'D (1300-2330)' },
  { value: 'E', label: 'E (1700-0330)' },
  { value: 'F', label: 'F (2100-0730)' },
];

const DispatcherProfileSection: React.FC<Props> = ({ dispatcher, onUpdate, onRemove }) => {
  return (
    <div className="dispatcher-profile-section">
      <div className="section-title">Profile</div>

      <label className="profile-label" htmlFor={`profile-id-${dispatcher.id}`}>
        ID
      </label>
      <input
        id={`profile-id-${dispatcher.id}`}
        type="text"
        value={dispatcher.id}
        onChange={(e) => onUpdate('id', e.target.value.toUpperCase())}
        className="profile-input"
      />

      <label className="profile-label" htmlFor={`profile-name-${dispatcher.id}`}>
        Name
      </label>
      <input
        id={`profile-name-${dispatcher.id}`}
        type="text"
        value={dispatcher.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        className="profile-input"
      />

      <label className="profile-label" htmlFor={`profile-badge-${dispatcher.id}`}>
        Badge
      </label>
      <input
        id={`profile-badge-${dispatcher.id}`}
        type="number"
        value={dispatcher.badgeNumber ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          const numValue = value ? parseInt(value, 10) : undefined;
          onUpdate('badgeNumber', numValue);
        }}
        className="profile-input"
      />

      <label className="profile-label" htmlFor={`profile-shift-${dispatcher.id}`}>
        Shift
      </label>
      <select
        id={`profile-shift-${dispatcher.id}`}
        value={dispatcher.shift || 'A'}
        onChange={(e) => onUpdate('shift', e.target.value)}
        className="profile-select"
      >
        {shiftOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {typeof dispatcher.seniority === 'number' && (
        <div className="seniority-pill" title={`Seniority rank: ${dispatcher.seniority}`}>
          #{dispatcher.seniority}
        </div>
      )}

      <button
        className="delete-dispatcher-btn"
        onClick={onRemove}
        type="button"
      >
        Delete Dispatcher
      </button>
    </div>
  );
};

export default DispatcherProfileSection;
