import { useState, useEffect } from 'react';
export const useNetworkStats = () => {
  const [stats, setStats] = useState({ cpu: '0%', ram: '0 GB', storage: '0%', uptime: '0m', dnsRequests: 0, blockedRequests: 0, dockerStatus: 'Unknown', tunnelStatus: 'Unknown' });
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/health');
        const data = await res.json();
        setStats(data);
      } catch (e) { console.error("Failed to fetch stats", e); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);
  return stats;
};
