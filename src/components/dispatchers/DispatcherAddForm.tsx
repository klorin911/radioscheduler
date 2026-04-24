import React, { useState } from 'react';

interface Props {
  newShortName: string;
  newName: string;
  newBadge: string;
  onShortNameChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onBadgeChange: (v: string) => void;
  onAdd: () => void;
}

const DispatcherAddForm: React.FC<Props> = ({
  newShortName,
  newName,
  newBadge,
  onShortNameChange,
  onNameChange,
  onBadgeChange,
  onAdd,
}) => {
  const [expanded, setExpanded] = useState(false);

  const canAdd = newShortName.trim().length > 0 && newName.trim().length > 0;

  const handleShortNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onShortNameChange(e.target.value.toUpperCase());
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd();
  };

  return (
    <div className="add-dispatcher">
      {!expanded ? (
        <button
          className="add-form-toggle"
          onClick={() => setExpanded(true)}
          type="button"
        >
          + Add dispatcher
        </button>
      ) : (
        <div className="add-dispatcher-form">
          <input
            type="text"
            className="add-form-input add-dispatcher-input"
            placeholder="ID"
            value={newShortName}
            onChange={handleShortNameChange}
          />
          <input
            type="text"
            className="add-form-input add-dispatcher-input"
            placeholder="Name"
            value={newName}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <input
            type="text"
            className="add-form-input add-dispatcher-input"
            placeholder="Badge"
            value={newBadge}
            onChange={(e) => onBadgeChange(e.target.value)}
          />
          <button
            className="add-form-btn add-dispatcher-btn"
            onClick={handleAdd}
            disabled={!canAdd}
            type="button"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
};

export default DispatcherAddForm;
