import React, { useState, useMemo, useEffect } from 'react';
import { ExtendedDispatcher } from '../appTypes';
import {
  DispatcherListHeader,
  DispatcherAddForm,
  DispatcherListItem,
  DispatcherProfileSection,
  DispatcherScheduleSection,
  DispatcherPreferencesSection,
} from './dispatchers';
import '../styles/manage-dispatchers.css';

interface Props {
  dispatchers: ExtendedDispatcher[];
  onChange: (list: ExtendedDispatcher[]) => void;
}

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ManageDispatchers: React.FC<Props> = ({ dispatchers, onChange }) => {
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string | null>(null);
  const [newShortName, setNewShortName] = useState('');
  const [newName, setNewName] = useState('');
  const [newBadge, setNewBadge] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Normalize legacy data: remove any 'RELIEF' entries from preferredChannels
  useEffect(() => {
    let changed = false;
    const updated = dispatchers.map(d => {
      const pc = d.preferredChannels || [];
      if (pc.includes('RELIEF')) {
        changed = true;
        return { ...d, preferredChannels: pc.filter(ch => ch !== 'RELIEF') };
      }
      return d;
    });
    if (changed) onChange(updated);
  }, [dispatchers, onChange]);

  // Filter dispatchers based on search term
  const filteredDispatchers = useMemo(() => {
    if (!searchTerm.trim()) return dispatchers;
    const search = searchTerm.toLowerCase();
    return dispatchers.filter((dispatcher) => {
      const matchesId = dispatcher.id.toLowerCase().includes(search);
      const matchesName = dispatcher.name.toLowerCase().includes(search);
      const matchesBadge = dispatcher.badgeNumber && dispatcher.badgeNumber.toString().includes(search);
      return matchesId || matchesName || matchesBadge;
    });
  }, [dispatchers, searchTerm]);

  useEffect(() => {
    if (filteredDispatchers.length === 0) {
      setSelectedDispatcherId(null);
      return;
    }
    const selectedIsVisible = filteredDispatchers.some((dispatcher) => dispatcher.id === selectedDispatcherId);
    if (!selectedDispatcherId || !selectedIsVisible) {
      setSelectedDispatcherId(filteredDispatchers[0].id);
    }
  }, [filteredDispatchers, selectedDispatcherId]);

  const selectedIndex = selectedDispatcherId
    ? dispatchers.findIndex((dispatcher) => dispatcher.id === selectedDispatcherId)
    : -1;
  const selectedDispatcher = selectedIndex >= 0 ? dispatchers[selectedIndex] : null;
  const selectedTrainees = selectedDispatcher
    ? dispatchers.filter((dispatcher) => dispatcher.isTrainee === true && dispatcher.traineeOf === selectedDispatcher.id)
    : [];

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
        isTrainee: false,
        followTrainerSchedule: false,
        minimumRadioOnly: false,
        wantsExtraUtility: false,
        excludeFromAutoSchedule: false,
      },
    ]);
    setSelectedDispatcherId(id);
    setSearchTerm('');
    setNewShortName('');
    setNewName('');
    setNewBadge('');
  };

  const update = <K extends keyof ExtendedDispatcher>(index: number, field: K, value: ExtendedDispatcher[K]) => {
    const copy = [...dispatchers];
    copy[index][field] = value;
    onChange(copy);
    if (field === 'id') {
      setSelectedDispatcherId(String(value));
    }
  };

  const remove = (index: number) => {
    const removedId = dispatchers[index]?.id;
    const copy = [...dispatchers];
    copy.splice(index, 1);
    onChange(copy);
    if (removedId === selectedDispatcherId) {
      const nextSelection = copy[index] ?? copy[index - 1] ?? copy[0] ?? null;
      setSelectedDispatcherId(nextSelection?.id ?? null);
    }
  };

  // Rotate each dispatcher's selected work days forward by one day (Mon->Tue, ..., Sun->Mon)
  const rotateAllWorkDaysForward = () => {
    const nextDay = (day: string): string => {
      const idx = weekDays.indexOf(day);
      if (idx === -1) return day;
      return weekDays[(idx + 1) % weekDays.length];
    };
    const rotated = dispatchers.map((d) => {
      const days = d.workDays || [];
      if (!Array.isArray(days) || days.length === 0) return d;
      const newDays = days.map(nextDay);
      const uniqueOrdered = weekDays.filter((wd) => newDays.includes(wd));
      return { ...d, workDays: uniqueOrdered } as ExtendedDispatcher;
    });
    onChange(rotated);
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
      <DispatcherListHeader
        count={filteredDispatchers.length}
        total={dispatchers.length}
      />

      <div className="dispatchers-workspace">
        <section className="dispatchers-list-panel" aria-label="Dispatcher list">
          <div className="dispatcher-list-controls">
            <input
              type="text"
              className="dispatcher-list-search search-input"
              placeholder="Search dispatchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="dispatcher-list-actions">
              <button
                className="btn-ghost"
                onClick={() => {
                  const confirmed = window.confirm(
                    'Rotate all selected work days forward by one (Mon→Tue, …, Sun→Mon)?'
                  );
                  if (confirmed) rotateAllWorkDaysForward();
                }}
                type="button"
              >
                Rotate +1
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setNewShortName(''); setNewName(''); setNewBadge(''); setSearchTerm(''); }}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>

          <DispatcherAddForm
            newShortName={newShortName}
            newName={newName}
            newBadge={newBadge}
            onShortNameChange={setNewShortName}
            onNameChange={setNewName}
            onBadgeChange={setNewBadge}
            onAdd={addDispatcher}
          />

          <div className="dispatchers-table-header">
            <span>Name</span>
            <span>Badge</span>
          </div>

          <div className="dispatchers-list">
            {filteredDispatchers.map((d) => {
              const originalIndex = dispatchers.indexOf(d);

              return (
                <DispatcherListItem
                  key={`dispatcher-${d.id}-${originalIndex}`}
                  dispatcher={d}
                  isSelected={d.id === selectedDispatcherId}
                  onSelect={() => setSelectedDispatcherId(d.id)}
                />
              );
            })}
          </div>

          {dispatchers.length === 0 && (
            <div className="dispatcher-empty-state">No dispatchers yet. Add one to start building the roster.</div>
          )}
          {dispatchers.length > 0 && filteredDispatchers.length === 0 && (
            <div className="dispatcher-empty-state">No dispatchers match “{searchTerm}”.</div>
          )}
        </section>

        <aside className="dispatcher-detail-panel" aria-label="Selected dispatcher details">
          {selectedDispatcher && selectedIndex >= 0 ? (
            <>
              <div className="detail-panel-header">
                <div>
                  <div className="detail-panel-kicker">Selected Dispatcher</div>
                  <h3>{selectedDispatcher.id}</h3>
                  <p>{selectedDispatcher.name}</p>
                </div>
                <div className="role-badges detail-role-badges">
                  {selectedDispatcher.isTrainee && (
                    <span className="role-badge trainee" title="Trainee" aria-label="Trainee">
                      T
                    </span>
                  )}
                  {selectedTrainees.length > 0 && (
                    <span
                      className="role-badge trainer"
                      title={`Trainer (${selectedTrainees.map((t) => t.id).join(', ')})`}
                      aria-label="Trainer"
                    >
                      TR
                    </span>
                  )}
                </div>
              </div>

              <div className="dispatcher-detail-sections">
                <DispatcherProfileSection
                  dispatcher={selectedDispatcher}
                  onUpdate={(field, value) => update(selectedIndex, field, value)}
                  onRemove={() => remove(selectedIndex)}
                />
                <DispatcherScheduleSection
                  dispatcher={selectedDispatcher}
                  dispatchers={dispatchers}
                  onUpdate={(field, value) => update(selectedIndex, field, value)}
                  onToggleWorkDay={(day) => toggleWorkDay(selectedIndex, day)}
                />
                <DispatcherPreferencesSection
                  dispatcher={selectedDispatcher}
                  onUpdate={(field, value) => update(selectedIndex, field, value)}
                  onMoveChannelUp={(idx) => moveChannelUp(selectedIndex, idx)}
                  onMoveChannelDown={(idx) => moveChannelDown(selectedIndex, idx)}
                  onAddChannel={(ch) => addChannel(selectedIndex, ch)}
                  onRemoveChannel={(ch) => removeChannel(selectedIndex, ch)}
                  onAddTimeBlock={(tb) => addTimeBlock(selectedIndex, tb)}
                  onRemoveTimeBlock={(tb) => removeTimeBlock(selectedIndex, tb)}
                />
              </div>
            </>
          ) : (
            <div className="dispatcher-empty-state detail-empty-state">
              Select a dispatcher to edit profile, schedule, and preferences.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ManageDispatchers;
