import React from 'react';
import { ExtendedDispatcher } from '../../appTypes';
import { days } from '../../constants';

interface Props {
  dispatcher: ExtendedDispatcher;
  dispatchers: ExtendedDispatcher[];
  onUpdate: <K extends keyof ExtendedDispatcher>(field: K, value: ExtendedDispatcher[K]) => void;
  onToggleWorkDay: (day: string) => void;
}

const dayAbbreviations: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const DispatcherScheduleSection: React.FC<Props> = ({ dispatcher, dispatchers, onUpdate, onToggleWorkDay }) => {
  const isFollowTrainer = dispatcher.isTrainee && dispatcher.followTrainerSchedule;

  const handleTraineeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    onUpdate('isTrainee', checked);
    if (!checked) {
      onUpdate('traineeOf', undefined);
      onUpdate('followTrainerSchedule', false);
    }
  };

  const handleFollowTrainerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    onUpdate('followTrainerSchedule', checked);
    if (checked && dispatcher.traineeOf) {
      const trainer = dispatchers.find((d) => d.id === dispatcher.traineeOf);
      if (trainer) {
        onUpdate('shift', trainer.shift);
        onUpdate('workDays', trainer.workDays ? [...trainer.workDays] : []);
      }
    }
  };

  const trainerOptions = dispatchers
    .filter((d) => d.id !== dispatcher.id && !d.isTrainee)
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="dispatcher-schedule-section">
      <div className="section-title">Schedule</div>

      <div className="work-days-row">
        {days.map((day) => {
          const isSelected = dispatcher.workDays?.includes(day) ?? false;
          return (
            <button
              key={day}
              type="button"
              className={`day-pill${isSelected ? ' selected' : ''}`}
              onClick={() => onToggleWorkDay(day)}
              disabled={isFollowTrainer}
              title={day}
            >
              {dayAbbreviations[day]}
            </button>
          );
        })}
      </div>

      <div className="training-subsection">
        <div className="section-subtitle">Training</div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={dispatcher.isTrainee ?? false}
            onChange={handleTraineeChange}
          />
          <span>Trainee</span>
        </label>

        {dispatcher.isTrainee && (
          <>
            <select
              className="trainer-select"
              value={dispatcher.traineeOf || ''}
              onChange={(e) => onUpdate('traineeOf', e.target.value || undefined)}
            >
              <option value="">Select trainer...</option>
              {trainerOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} — {d.name}
                </option>
              ))}
            </select>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={dispatcher.followTrainerSchedule ?? false}
                onChange={handleFollowTrainerChange}
                disabled={!dispatcher.traineeOf}
              />
              <span>Follow trainer schedule</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
};

export default DispatcherScheduleSection;
