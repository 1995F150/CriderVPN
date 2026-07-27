import { useState, useEffect } from 'react';

export const useServerTelemetry = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3000/api/v1/telemetry/stream');

    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        console.error('Failed to parse telemetry data', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setError('Connection lost');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { data, error };
};
