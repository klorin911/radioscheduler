import React, { useState } from 'react';
import { Dispatcher } from '../types';
import '../styles/manage-dispatchers.css';

interface ExtendedDispatcher extends Dispatcher {
  badgeNumber?: string;
  preferredChannels?: string[]; // ordered array
  preferredTimeBlocks?: string[]; // ordered array
  workDays?: string[]; // array of selected days
  shift?: string; // A-F
}

interface Props {
  dispatchers: ExtendedDispatcher[];
  onChange: (list: ExtendedDispatcher[]) => void;
}

const channels = ['SW', 'CE', 'SE', 'NE', 'NW', 'MT', 'UT', 'RE'];
const timeBlocks = [
  '0330-0530', '0530-0730', '0730-0930', '0930-1130', '1130-1330',
  '1330-1530', '1530-1730', '1730-1930', '1930-2130', '2130-2330',
  '2330-0130', '0130-0330'
];
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ManageDispatchers: React.FC<Props> = ({ dispatchers, onChange }) => {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  const addDispatcher = () => {
    if (!newId.trim()) return;
    const exists = dispatchers.find((d) => d.id === newId.trim());
    if (exists) return;
    onChange([
      ...dispatchers,
      {
        id: newId.trim(),
        name: newName.trim() || newId.trim(),
        badgeNumber: '',
        preferredChannels: [],
        preferredTimeBlocks: [],
        workDays: [],
        shift: 'A',
      },
    ]);
    setNewId('');
    setNewName('');
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
        <h2 className="manage-dispatchers-title">Manage Dispatchers</h2>
        <button
          onClick={() => {
            // Clear form
            setNewId('');
            setNewName('');
            // Collapse all cards
            setExpandedCard(null);
          }}
          className="add-dispatcher-btn"
        >
          Collapse All
        </button>
      </div>

      {/* Add Dispatcher Form */}
      <div className="add-dispatcher-form">
        <input
          placeholder="ID (required)"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          className="add-dispatcher-input"
        />
        <input
          placeholder="Name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="add-dispatcher-input"
        />
        <button
          onClick={addDispatcher}
          disabled={!newId.trim()}
          className="add-dispatcher-btn"
        >
          Add Dispatcher
        </button>
      </div>

      {/* Dispatcher Cards */}
      <div className="dispatchers-list">
        {dispatchers.map((d, i) => (
          <div key={d.id} className="dispatcher-card">
            {/* Card Header */}
            <div 
              onClick={() => setExpandedCard(expandedCard === i ? null : i)}
              className="dispatcher-card-header"
            >
              <div className="dispatcher-card-header-content">
                <div>
                  <input
                    value={d.id}
                    onChange={(e) => update(i, 'id', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="dispatcher-id-input"
                  />
                </div>
                <div>
                  <input
                    value={d.name}
                    onChange={(e) => update(i, 'name', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="dispatcher-name-input"
                  />
                </div>
                <input
                  placeholder="Badge #"
                  value={d.badgeNumber || ''}
                  onChange={(e) => update(i, 'badgeNumber', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="dispatcher-badge-input"
                />
                <select
                  value={d.shift || 'A'}
                  onChange={(e) => update(i, 'shift', e.target.value)}
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
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="delete-btn"
                >
                  Delete
                </button>
                <span className="expand-icon">
                  {expandedCard === i ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedCard === i && (
              <div className="dispatcher-card-expanded-content">
                {/* Work Days */}
                <div className="work-days-container">
                  <h4 className="section-title">Work Days</h4>
                  <div className="work-days-buttons">
                    {weekDays.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleWorkDay(i, day)}
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
                            onClick={() => addChannel(i, channel)}
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
                            <button onClick={() => moveChannelUp(i, idx)} disabled={idx === 0} className="channel-action-btn move-up-btn">↑</button>
                            <button onClick={() => moveChannelDown(i, idx)} disabled={idx === (d.preferredChannels || []).length - 1} className="channel-action-btn move-down-btn">↓</button>
                            <button onClick={() => removeChannel(i, channel)} className="channel-action-btn remove-channel-btn">×</button>
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
                            onClick={() => addTimeBlock(i, timeBlock)}
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
                            <button onClick={() => removeTimeBlock(i, timeBlock)} className="remove-time-block-btn">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageDispatchers;
