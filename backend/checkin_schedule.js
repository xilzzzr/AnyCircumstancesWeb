const DAY = 86400000;
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function normalizeSchedule(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_schedule');
  const { timeZone, startDate, mode } = input;
  if (!['days', 'weeks', 'month'].includes(mode) || !validDate(startDate)) throw new Error('invalid_schedule');
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); } catch { throw new Error('invalid_time_zone'); }
  if (typeof timeZone !== 'string' || !timeZone) throw new Error('invalid_time_zone');
  if (!Array.isArray(input.times) || !input.times.length || input.times.length > 24 ||
      input.times.some(t => typeof t !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) throw new Error('invalid_schedule_times');
  const times = [...new Set(input.times)].sort();
  const interval = mode === 'month' ? 1 : input.interval;
  if (!Number.isInteger(interval) || interval < 1 || interval > (mode === 'days' ? 365 : 52)) throw new Error('invalid_schedule_interval');
  const selected = mode === 'weeks' ? input.weekdays : mode === 'month' ? input.monthDays : [];
  const max = mode === 'weeks' ? 6 : 31;
  const min = mode === 'weeks' ? 0 : 1;
  if (mode !== 'days' && (!Array.isArray(selected) || !selected.length || selected.length > max + 1 || selected.some(d => !Number.isInteger(d) || d < min || d > max))) throw new Error('invalid_schedule_days');
  return { mode, timeZone, startDate, times, interval,
    ...(mode === 'weeks' ? { weekdays: [...new Set(selected)].sort((a,b) => a-b) } : {}),
    ...(mode === 'month' ? { monthDays: [...new Set(selected)].sort((a,b) => a-b) } : {}) };
}
function readSchedule(row) {
  if (!row?.schedule_json) return null;
  return normalizeSchedule(typeof row.schedule_json === 'string' ? JSON.parse(row.schedule_json) : row.schedule_json);
}
function formatter(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
}
function localStamp(fmt, instant) {
  const parts = Object.fromEntries(fmt.formatToParts(instant).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}
// Resolve repeated times once (the first occurrence). For a DST gap, move forward
// by the gap, e.g. 02:30 -> 03:30. No server-local timezone arithmetic is used.
function wallTimeToUtc(day, time, fmt) {
  const wall = Date.parse(day + 'T' + time + ':00Z');
  const offsets = new Set();
  for (let h = -36; h <= 36; h += 6) {
    const sample = wall + h * 3600000;
    offsets.add(localStamp(fmt, sample) - sample);
  }
  const candidates = [...offsets].map(offset => wall - offset).sort((a,b) => a-b);
  const exact = candidates.find(c => localStamp(fmt,c) === wall);
  if (exact !== undefined) return new Date(exact);
  const forward = candidates.filter(c => localStamp(fmt,c) > wall).sort((a,b) => localStamp(fmt,a) - localStamp(fmt,b));
  return new Date(forward[0]);
}
function nextScheduledCheckin(schedule, after) {
  const s = normalizeSchedule(schedule);
  if (!s || !Number.isFinite(+new Date(after))) throw new Error('invalid_schedule');
  const fmt = formatter(s.timeZone);
  const afterMs = +new Date(after);
  const today = Math.floor(localStamp(fmt, afterMs) / DAY) * DAY;
  const anchor = Date.parse(s.startDate + 'T00:00:00Z');
  // Week recurrence is anchored to Monday of the start-date week.
  const monday = d => d - ((new Date(d).getUTCDay() + 6) % 7) * DAY;
  for (let d = Math.max(today, anchor), end = d + 740 * DAY; d <= end; d += DAY) {
    const date = new Date(d);
    if (s.mode === 'days' && ((d - anchor) / DAY) % s.interval !== 0) continue;
    if (s.mode === 'weeks' && (!s.weekdays.includes(date.getUTCDay()) || ((monday(d) - monday(anchor)) / (7 * DAY)) % s.interval !== 0)) continue;
    if (s.mode === 'month' && !s.monthDays.includes(date.getUTCDate())) continue;
    const candidates = s.times.map(time => wallTimeToUtc(date.toISOString().slice(0,10), time, fmt)).sort((a,b) => +a - +b);
    const next = candidates.find(candidate => +candidate > afterMs);
    if (next) return next;
  }
  throw new Error('schedule_has_no_future_occurrence');
}
// An open grace period belongs to the oldest outstanding due time. Editing or
// visiting settings must never clear it; only a successful check-in advances it.
function nextDueAfterSave(existing, schedule, now, fallback) {
  if (existing?.next_due_at && +new Date(existing.next_due_at) <= +now) return new Date(existing.next_due_at);
  return schedule ? nextScheduledCheckin(schedule, now) : existing?.next_due_at ? new Date(existing.next_due_at) : fallback;
}
module.exports = { normalizeSchedule, readSchedule, nextScheduledCheckin, nextDueAfterSave };
