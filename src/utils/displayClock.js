export function createDisplayClockFormatters(timeZone = 'America/New_York') {
  let time;
  try {
    time = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  } catch {
    timeZone = 'America/New_York';
    time = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  }
  return { timeZone, time, date: new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) };
}
