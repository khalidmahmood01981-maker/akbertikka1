import React, { useState, useEffect } from 'react';

interface TimeElapsedProps {
  timestamp: number;
  statusTimestamps?: Record<string, number>;
  currentStatus?: string;
  className?: string;
}

const TimeElapsed: React.FC<TimeElapsedProps> = ({ timestamp, statusTimestamps, currentStatus, className = "" }) => {
  const [elapsed, setElapsed] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateElapsed = () => {
      // Use status specific timestamp if available, otherwise use original order timestamp
      const startTime = (currentStatus && statusTimestamps?.[currentStatus]) || timestamp;
      const now = Date.now();
      const diffInMs = now - startTime;
      const diffInMins = Math.floor(diffInMs / (1000 * 60));
      
      setIsUrgent(diffInMins >= 15);

      if (diffInMins < 1) {
        setElapsed('Just now');
      } else if (diffInMins < 60) {
        setElapsed(`${diffInMins}m ago`);
      } else {
        const hours = Math.floor(diffInMins / 60);
        const mins = diffInMins % 60;
        setElapsed(`${hours}h ${mins}m ago`);
      }
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [timestamp, statusTimestamps, currentStatus]);

  return (
    <span className={`${className} ${isUrgent ? 'text-red-500 animate-pulse' : ''}`}>
      {elapsed}
    </span>
  );
};

export default TimeElapsed;
