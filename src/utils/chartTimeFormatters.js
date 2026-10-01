// Format labels only: never shift market timestamps or replay identities.
export function createChartTimeFormatters(timeZone = 'America/New_York', intraday = true) {
  let zone = timeZone;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); } catch { zone = 'America/New_York'; }
  const formatter = options => new Intl.DateTimeFormat('en-US', { timeZone: intraday ? zone : 'UTC', ...options });
  const years = formatter({ year: 'numeric' }), months = formatter({ month: 'short' }), days = formatter({ day: 'numeric' });
  const hours = formatter({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const seconds = formatter({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const full = formatter({ year: 'numeric', month: 'short', day: 'numeric', ...(intraday ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' } : {}) });
  const calendar = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
  const calendarTicks = [new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' }), new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }), new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric' })];
  const dateOf = time => typeof time === 'number' ? new Date(time * 1000)
    : typeof time === 'string' ? new Date(`${time}T12:00:00Z`)
      : time && typeof time === 'object' ? new Date(Date.UTC(time.year, time.month - 1, time.day, 12)) : new Date(NaN);
  return { timeZone: zone,
    timeFormatter: time => { const date = dateOf(time); return Number.isFinite(date.getTime()) ? (typeof time === 'number' ? full : calendar).format(date) : 'Unavailable'; },
    tickMarkFormatter: (time, type) => {
      const date = dateOf(time); if (!Number.isFinite(date.getTime())) return null;
      if (typeof time !== 'number') return (calendarTicks[type] || calendarTicks[2]).format(date);
      return ({ 0: years, 1: months, 2: days, 3: hours, 4: seconds }[type] || days).format(date);
    },
  };
}
