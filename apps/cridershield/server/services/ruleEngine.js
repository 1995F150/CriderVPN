const rulesDb = require('../database/rulesDb');

const presets = {
  'school-hours': { days: [1, 2, 3, 4, 5], start: '08:00', end: '15:00' },
  'night-hours': { days: [0, 1, 2, 3, 4, 5, 6], start: '21:00', end: '06:00' },
  'weekends': { days: [0, 6], start: '00:00', end: '23:59' }
};

const isTimeInRange = (current, start, end) => {
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end; // Over midnight
};

const evaluateSchedule = (scheduleJson) => {
  if (!scheduleJson) return true;
  try {
    const config = typeof scheduleJson === 'string' ? JSON.parse(scheduleJson) : scheduleJson;
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    let schedule = config;
    if (config.preset && presets[config.preset]) {
      schedule = presets[config.preset];
    }

    if (schedule.days && !schedule.days.includes(day)) return false;
    if (schedule.start && schedule.end) {
      return isTimeInRange(time, schedule.start, schedule.end);
    }
    return true;
  } catch (e) {
    return true;
  }
};

const evaluate = async (domain, clientMac) => {
  return new Promise((resolve) => {
    rulesDb.getAll((err, rules) => {
      if (err) return resolve({ action: 'ALLOW' });

      const activeRules = rules.filter(r => {
        if (!r.enabled) return false;
        if (r.expires_at && new Date(r.expires_at) < new Date()) return false;
        
        if (r.type === 'device' && r.target !== clientMac) return false;
        
        const domainMatch = r.domain && (domain === r.domain || (r.domain.startsWith('*') && domain.endsWith(r.domain.slice(1))));
        if (!domainMatch && r.type !== 'global' && !r.category) return false;
        
        return evaluateSchedule(r.schedule);
      });

      if (activeRules.length === 0) return resolve({ action: 'ALLOW' });

      const winningRule = activeRules[0];
      resolve({ action: winningRule.action, rule: winningRule });
    });
  });
};

module.exports = { evaluate };
