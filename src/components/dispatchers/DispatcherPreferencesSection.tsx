import React from 'react';
import { ExtendedDispatcher } from '../../appTypes';
import { selectableChannels, timeSlots } from '../../constants';

interface Props {
  dispatcher: ExtendedDispatcher;
  onUpdate: <K extends keyof ExtendedDispatcher>(field: K, value: ExtendedDispatcher[K]) => void;
  onMoveChannelUp: (index: number) => void;
  onMoveChannelDown: (index: number) => void;
  onAddChannel: (channel: string) => void;
  onRemoveChannel: (channel: string) => void;
  onAddTimeBlock: (timeBlock: string) => void;
  onRemoveTimeBlock: (timeBlock: string) => void;
}

const DispatcherPreferencesSection: React.FC<Props> = ({
  dispatcher,
  onUpdate,
  onMoveChannelUp,
  onMoveChannelDown,
  onAddChannel,
  onRemoveChannel,
  onAddTimeBlock,
  onRemoveTimeBlock,
}) => {
  const preferredChannels = (dispatcher.preferredChannels ?? []).filter((c) => c !== 'RELIEF');
  const availableChannels = selectableChannels.filter((c) => !preferredChannels.includes(c));
  const preferredTimeBlocks = dispatcher.preferredTimeBlocks ?? [];
  const availableTimeBlocks = timeSlots.filter((t) => !preferredTimeBlocks.includes(t));

  const togglePref = (field: 'minimumRadioOnly' | 'wantsExtraUtility' | 'excludeFromAutoSchedule') => {
    onUpdate(field, !dispatcher[field]);
  };

  return (
    <div className="dispatcher-preferences-section">
      <div className="section-title">Preferences</div>

      <div className="preferences-subsection">
        <div className="section-subtitle">Channel Priority</div>

        {preferredChannels.length === 0 ? (
          <div className="empty-state">No channels prioritized.</div>
        ) : (
          <div className="channel-rank-list">
            {preferredChannels.map((channel, index) => (
              <div key={channel} className="channel-rank-item">
                <span className="rank-number">#{index + 1}</span>
                <span className="channel-name">{channel}</span>
                <button
                  type="button"
                  className="rank-btn"
                  onClick={() => onMoveChannelUp(index)}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rank-btn"
                  onClick={() => onMoveChannelDown(index)}
                  disabled={index === preferredChannels.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rank-btn remove"
                  onClick={() => onRemoveChannel(channel)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="add-channel-row">
          <span className="add-label">Add channel:</span>
          <div className="add-pills-row">
            {availableChannels.map((channel) => (
              <button
                key={channel}
                type="button"
                className="add-pill-btn"
                onClick={() => onAddChannel(channel)}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="preferences-subsection">
        <div className="section-subtitle">Preferred Time Blocks</div>

        <div className="time-block-grid">
          {availableTimeBlocks.map((block) => (
            <button
              key={block}
              type="button"
              className="time-block-btn"
              onClick={() => onAddTimeBlock(block)}
            >
              {block}
            </button>
          ))}
        </div>

        {preferredTimeBlocks.length === 0 ? (
          <div className="empty-state">No time blocks selected.</div>
        ) : (
          <div className="selected-pills">
            {preferredTimeBlocks.map((block) => (
              <span key={block} className="selected-pill">
                {block}
                <button
                  type="button"
                  className="pill-remove"
                  onClick={() => onRemoveTimeBlock(block)}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="preferences-subsection">
        <div
          className={`pref-toggle${dispatcher.minimumRadioOnly ? ' active' : ''}`}
          onClick={() => togglePref('minimumRadioOnly')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePref('minimumRadioOnly');
            }
          }}
        >
          <span className="pref-check">{dispatcher.minimumRadioOnly ? '✓' : ''}</span>
          <span className="pref-label">Minimum Radio Only</span>
        </div>

        <div
          className={`pref-toggle${dispatcher.wantsExtraUtility ? ' active' : ''}`}
          onClick={() => togglePref('wantsExtraUtility')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePref('wantsExtraUtility');
            }
          }}
        >
          <span className="pref-check">{dispatcher.wantsExtraUtility ? '✓' : ''}</span>
          <span className="pref-label">Extra Utility</span>
        </div>

        <div
          className={`pref-toggle${dispatcher.excludeFromAutoSchedule ? ' active' : ''}`}
          onClick={() => togglePref('excludeFromAutoSchedule')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePref('excludeFromAutoSchedule');
            }
          }}
        >
          <span className="pref-check">{dispatcher.excludeFromAutoSchedule ? '✓' : ''}</span>
          <span className="pref-label">Exclude from Auto Schedule</span>
        </div>
      </div>
    </div>
  );
};

export default DispatcherPreferencesSection;
