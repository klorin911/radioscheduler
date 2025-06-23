import React from 'react';
import './Schedule.css';

type Region = 'SW' | 'CE' | 'SE' | 'NE' | 'NW' | 'MT' | 'UT' | 'RE';

type TimeSlot = {
  id: string;
  startTime: string;
  endTime: string;
  regions: {
    [key in Region]?: {
      program: string;
      host?: string;
    };
  };
};

type DaySchedule = {
  day: string;
  timeSlots: TimeSlot[];
};

const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startHour = 3.5; // 3:30 AM
  const endHour = 25.5; // 1:30 AM next day
  
  for (let hour = startHour; hour < endHour; hour += 2) {
    const startHour24 = hour % 24;
    const endHour24 = (hour + 2) % 24;
    
    const formatTime = (hour: number): string => {
      const displayHour = Math.floor(hour).toString().padStart(2, '0');
      const minutes = hour % 1 === 0.5 ? '30' : '00';
      return `${displayHour}${minutes}`;
    };

    const startTime = formatTime(startHour24);
    const endTime = formatTime(endHour24);
    
    slots.push({
      id: `slot-${hour}`,
      startTime,
      endTime,
      regions: {}
    });
  }
  
  // Add the 1:30 AM - 3:30 AM slot at the end
  slots.push({
    id: 'slot-1.5',
    startTime: '0130',
    endTime: '0330',
    regions: {}
  });
  
  return slots;
};

export const Schedule: React.FC = () => {
  // Generate time slots for each day
  const weekSchedule: DaySchedule[] = [
    { day: 'Monday', timeSlots: generateTimeSlots() },
    { day: 'Tuesday', timeSlots: generateTimeSlots() },
    { day: 'Wednesday', timeSlots: generateTimeSlots() },
    { day: 'Thursday', timeSlots: generateTimeSlots() },
    { day: 'Friday', timeSlots: generateTimeSlots() },
    { day: 'Saturday', timeSlots: generateTimeSlots() },
    { day: 'Sunday', timeSlots: generateTimeSlots() },
  ];

  const regions: Region[] = ['SW', 'CE', 'SE', 'NE', 'NW', 'MT', 'UT', 'RE'];

  return (
    <div className="schedule-container">
      <h1>Radio Schedule</h1>
      <div className="days-container">
        {weekSchedule.map((day) => (
          <div key={day.day} className="day-schedule">
            <div className="day-header">
              <h2>{day.day}</h2>
            </div>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Time</th>
                  {regions.map(region => (
                    <th key={region} className="region-header">{region}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {day.timeSlots.map((slot) => (
                  <tr key={slot.id} className="time-slot">
                    <td className="time-cell">
                      {slot.startTime} - {slot.endTime}
                    </td>
                    {regions.map(region => (
                      <td key={region} className="region-cell">
                        {slot.regions[region] ? (
                          <div className="program-slot">
                            <div className="program-name">{slot.regions[region]?.program}</div>
                            {slot.regions[region]?.host && (
                              <div className="program-host">{slot.regions[region]?.host}</div>
                            )}
                          </div>
                        ) : (
                          <div className="empty-slot">-</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};
