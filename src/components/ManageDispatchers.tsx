import React, { useState, useMemo } from 'react';
import { ExtendedDispatcher } from '../types';
import '../styles/manage-dispatchers.css';

interface Props {
  dispatchers: ExtendedDispatcher[];
  onChange: (list: ExtendedDispatcher[]) => void;
}

import { columns as channels, timeSlots as timeBlocks } from '../constants';
const weekDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const ManageDispatchers: React.FC<Props> = ({ dispatchers, onChange }) => {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [newShortName, setNewShortName] = useState('');
  const [newName, setNewName] = useState('');
  const [newBadge, setNewBadge] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter dispatchers based on search term
  const filteredDispatchers = useMemo(() => {
    if (!searchTerm.trim()) return dispatchers;
    const search = searchTerm.toLowerCase();
    const filtered = dispatchers.filter((dispatcher) => {
      const matchesId = dispatcher.id.toLowerCase().includes(search);
      const matchesName = dispatcher.name.toLowerCase().includes(search);
      const matchesBadge = dispatcher.badgeNumber && dispatcher.badgeNumber.toString().includes(search);
      return matchesId || matchesName || matchesBadge;
    });
    console.log(`Search: "${searchTerm}" - Found ${filtered.length} of ${dispatchers.length}`);
    return filtered;
  }, [dispatchers, searchTerm]);



  const addDispatcher = () => {
    if (!newShortName.trim() || !newName.trim()) return;
    const id = newShortName.trim().toUpperCase();
    const exists = dispatchers.find((d) => d.id === id);
    if (exists) return;
    onChange([
      ...dispatchers,
      {
        id,
        name: newName.trim(),
        badgeNumber: newBadge.trim() ? parseInt(newBadge.trim(), 10) : undefined,
        preferredChannels: [],
        preferredTimeBlocks: [],
        workDays: [],
        shift: 'A',
      },
    ]);
    setNewShortName('');
    setNewName('');
    setNewBadge('');
  };

  const update = <K extends keyof ExtendedDispatcher>(index: number, field: K, value: ExtendedDispatcher[K]) => {
    const copy = [...dispatchers];
    copy[index][field] = value;
    onChange(copy);
  };

  const remove = (index: number) => {
    const copy = [...dispatchers];
    copy.splice(index, 1);
    onChange(copy);
  };

  const toggleWorkDay = (index: number, day: string) => {
    const current = dispatchers[index].workDays || [];
    const updated = current.includes(day) 
      ? current.filter(d => d !== day)
      : [...current, day];
    update(index, 'workDays', updated);
  };

  const moveChannelUp = (index: number, channelIndex: number) => {
    if (channelIndex === 0) return;
    const current = [...(dispatchers[index].preferredChannels || [])];
    [current[channelIndex], current[channelIndex - 1]] = [current[channelIndex - 1], current[channelIndex]];
    update(index, 'preferredChannels', current);
  };

  const moveChannelDown = (index: number, channelIndex: number) => {
    const current = [...(dispatchers[index].preferredChannels || [])];
    if (channelIndex === current.length - 1) return;
    [current[channelIndex], current[channelIndex + 1]] = [current[channelIndex + 1], current[channelIndex]];
    update(index, 'preferredChannels', current);
  };

  const addChannel = (index: number, channel: string) => {
    const current = dispatchers[index].preferredChannels || [];
    if (!current.includes(channel)) {
      update(index, 'preferredChannels', [...current, channel]);
    }
  };

  const removeChannel = (index: number, channel: string) => {
    const current = dispatchers[index].preferredChannels || [];
    update(index, 'preferredChannels', current.filter(c => c !== channel));
  };

  const addTimeBlock = (index: number, timeBlock: string) => {
    const current = dispatchers[index].preferredTimeBlocks || [];
    if (!current.includes(timeBlock)) {
      update(index, 'preferredTimeBlocks', [...current, timeBlock]);
    }
  };

  const removeTimeBlock = (index: number, timeBlock: string) => {
    const current = dispatchers[index].preferredTimeBlocks || [];
    update(index, 'preferredTimeBlocks', current.filter(t => t !== timeBlock));
  };

  return (
    <div className="manage-dispatchers-container">
      <div className="manage-dispatchers-header">
        <h2 className="manage-dispatchers-title">Manage Dispatchers ({filteredDispatchers.length}/{dispatchers.length})</h2>
        <div className="header-controls">
          <input
            type="text"
            placeholder="Search by ID, name, or badge number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => {
              setNewShortName('');
              setNewName('');
              setNewBadge('');
              setSearchTerm('');
              // Collapse all cards
              setExpandedCard(null);
            }}
            className="add-dispatcher-btn"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Add Dispatcher Form */}
      <div className="add-dispatcher-form">
        <input
          placeholder="Short Name/ID (e.g., KLOR) - required"
          value={newShortName}
          onChange={(e) => setNewShortName(e.target.value)}
          className="add-dispatcher-input"
        />
        <input
          placeholder="Full Name (required)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="add-dispatcher-input"
        />
        <input
          placeholder="Badge # (for seniority)"
          value={newBadge}
          onChange={(e) => setNewBadge(e.target.value)}
          className="add-dispatcher-input"
        />
        <button
          onClick={addDispatcher}
          disabled={!newShortName.trim() || !newName.trim()}
          className="add-dispatcher-btn"
        >
          Add Dispatcher
        </button>
      </div>

      {/* Dispatcher Cards */}
      <div className="dispatchers-list" key={`list-${searchTerm}-${filteredDispatchers.length}`}>
        {filteredDispatchers.map((d, filteredIndex) => {
          // Find the original index in the full dispatchers array
          const originalIndex = dispatchers.findIndex(dispatcher => dispatcher.id === d.id);
          return (
            <div key={d.id} className="dispatcher-card">
            {/* Card Header */}
            <div 
              onClick={() => setExpandedCard(expandedCard === filteredIndex ? null : filteredIndex)}
              className="dispatcher-card-header"
            >
              <div className="dispatcher-card-header-content">
                <div className="dispatcher-id-section">
                  <label>ID:</label>
                  <input
                    value={d.id}
                    onChange={(e) => update(originalIndex, 'id', e.target.value.toUpperCase())}
                    onClick={(e) => e.stopPropagation()}
                    className="dispatcher-id-input"
                    placeholder="Short Name (e.g., KLOR)"
                  />
                </div>
                <div className="dispatcher-name-section">
                  <label>Name:</label>
                  <input
                    value={d.name}
                    onChange={(e) => update(originalIndex, 'name', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="dispatcher-name-input"
                    placeholder="Full Name"
                  />
                </div>
                <div className="dispatcher-badge-section">
                  <label>Badge #:</label>
                  <input
                    placeholder="Badge # (seniority)"
                    value={d.badgeNumber || ''}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      const numValue = value ? parseInt(value, 10) : undefined;
                      update(originalIndex, 'badgeNumber', numValue);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="dispatcher-badge-input"
                  />
                </div>
                <select
                  value={d.shift || 'A'}
                  onChange={(e) => update(originalIndex, 'shift', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="dispatcher-shift-select"
                >
                  <option value="A">Shift A (0300-1330)</option>
                  <option value="B">Shift B (0700-1730)</option>
                  <option value="C">Shift C (1100-2130)</option>
                  <option value="D">Shift D (1300-2330)</option>
                  <option value="E">Shift E (1700-0330)</option>
                  <option value="F">Shift F (2100-0730)</option>
                </select>
              </div>
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(originalIndex); }}
                  className="delete-btn"
                >
                  Delete
                </button>
                <span className="expand-icon">
                  {expandedCard === filteredIndex ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedCard === filteredIndex && (
              <div className="dispatcher-card-expanded-content">
                {/* Work Days */}
                <div className="work-days-container">
                  <h4 className="section-title">Work Days</h4>
                  <div className="work-days-buttons">
                    {weekDays.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleWorkDay(originalIndex, day)}
                        className={`work-day-btn ${d.workDays?.includes(day) ? 'selected' : ''}`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred Channels */}
                <div className="channels-container">
                  <h4 className="section-title">Preferred Channels (Ranked)</h4>
                  <div className="channels-content">
                    <div className="channels-column">
                      <div className="section-subtitle">Available</div>
                      <div className="available-channels">
                        {channels.filter(ch => !(d.preferredChannels || []).includes(ch)).map(channel => (
                          <button
                            key={channel}
                            onClick={() => addChannel(originalIndex, channel)}
                            className="add-channel-btn"
                          >
                            + {channel}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="channels-column">
                      <div className="section-subtitle">Ranked Preferences</div>
                      <div className="ranked-channels">
                        {(d.preferredChannels || []).map((channel, idx) => (
                          <div key={channel} className="ranked-channel-item">
                            <span className="channel-rank">#{idx + 1}</span>
                            <span className="channel-name">{channel}</span>
                            <button onClick={() => moveChannelUp(originalIndex, idx)} disabled={idx === 0} className="channel-action-btn move-up-btn">↑</button>
                            <button onClick={() => moveChannelDown(originalIndex, idx)} disabled={idx === (d.preferredChannels || []).length - 1} className="channel-action-btn move-down-btn">↓</button>
                            <button onClick={() => removeChannel(originalIndex, channel)} className="channel-action-btn remove-channel-btn">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preferred Time Blocks */}
                <div className="time-blocks-container">
                  <h4 className="section-title">Preferred Time Blocks</h4>
                  <div className="time-blocks-content">
                    <div className="available-time-blocks">
                      <div className="section-subtitle">Available Time Blocks</div>
                      <div className="available-time-blocks-grid">
                        {timeBlocks.filter(tb => !(d.preferredTimeBlocks || []).includes(tb)).map(timeBlock => (
                          <button
                            key={timeBlock}
                            onClick={() => addTimeBlock(originalIndex, timeBlock)}
                            className="add-time-block-btn"
                          >
                            + {timeBlock}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="selected-time-blocks">
                      <div className="section-subtitle">Selected</div>
                      <div className="selected-time-blocks-list">
                        {(d.preferredTimeBlocks || []).map(timeBlock => (
                          <div key={timeBlock} className="selected-time-block-item">
                            <span className="time-block-text">{timeBlock}</span>
                            <button onClick={() => removeTimeBlock(originalIndex, timeBlock)} className="remove-time-block-btn">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ManageDispatchers;
