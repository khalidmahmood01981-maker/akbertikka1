export const getBusinessDate = (timestamp: number, startTimeStr: string = '00:00'): string => {
  const date = new Date(timestamp);
  
  // Parse format HH:mm
  const [startHour, startMinute] = startTimeStr.split(':').map(Number);
  
  if (!isNaN(startHour) && !isNaN(startMinute)) {
    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    
    // If current time is strictly before the start time, 
    // it belongs to the previous business day.
    if (currentHour < startHour || (currentHour === startHour && currentMinute < startMinute)) {
      date.setDate(date.getDate() - 1);
    }
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};
