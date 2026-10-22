import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type CheckinSchedule = {
  mode: 'days' | 'weeks' | 'month';
  interval: number;
  timeZone: string;
  startDate: string;
  times: string[];
  weekdays?: number[];
  monthDays?: number[];
};
function defaultCheckinSchedule(): CheckinSchedule {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { mode: 'days', interval: 1, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', startDate: localDate, times: ['09:00'] };
}
export function CheckinScheduleEditor({ value, onChange, disabled }: {
  value: CheckinSchedule | null; onChange: (value: CheckinSchedule | null) => void; disabled: boolean;
}) {
  const toggle = (list: number[], day: number) => list.includes(day) ? list.filter(d => d !== day) : [...list, day].sort((a,b) => a-b);
  const zones: string[] = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') || ['UTC', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="sr-only">Scheduled check-in options</legend>
    <Label className="flex items-center gap-2">
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked ? defaultCheckinSchedule() : null)} />
      Choose specific days and times
    </Label>
    {value && <>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label htmlFor="schedule-mode">Repeat</Label>
          <select id="schedule-mode" className="w-full rounded-md border bg-background p-2" value={value.mode} onChange={e => {
            const mode = e.target.value as CheckinSchedule['mode'];
            onChange({ ...value, mode, interval: 1, weekdays: mode === 'weeks' ? [1] : undefined, monthDays: mode === 'month' ? [1] : undefined });
          }}>
            <option value="days">Every N days</option><option value="weeks">Selected weekdays</option><option value="month">Selected dates each month</option>
          </select>
        </div>
        {value.mode !== 'month' && <div className="space-y-2"><Label htmlFor="schedule-interval">Every how many {value.mode === 'days' ? 'days' : 'weeks'}?</Label>
          <Input id="schedule-interval" type="number" min={1} max={value.mode === 'days' ? 365 : 52} value={value.interval} onChange={e => onChange({ ...value, interval: Number(e.target.value) })} />
        </div>}
        <div className="space-y-2"><Label htmlFor="schedule-start">Start date</Label><Input id="schedule-start" type="date" value={value.startDate} onChange={e => onChange({ ...value, startDate: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="schedule-zone">Time zone</Label><Input id="schedule-zone" list="schedule-zones" value={value.timeZone} onChange={e => onChange({ ...value, timeZone: e.target.value })} /><datalist id="schedule-zones">{[...new Set(['UTC', value.timeZone, ...zones])].map(z => <option value={z} key={z} />)}</datalist></div>
      </div>
      {value.mode === 'weeks' && <fieldset className="space-y-2"><legend className="text-sm font-medium">Days of the week</legend><div className="flex flex-wrap gap-3">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <Label key={day} className="flex items-center gap-2 p-2 border rounded-md"><input type="checkbox" checked={value.weekdays?.includes(index) || false} onChange={() => onChange({ ...value, weekdays: toggle(value.weekdays || [], index) })} />{day}</Label>)}</div><p className="text-xs text-muted-foreground">Weeks begin on Monday. Every 2 weeks means alternate weeks, starting with the week of your start date.</p></fieldset>}
      {value.mode === 'month' && <fieldset className="space-y-2"><legend className="text-sm font-medium">Dates of the month</legend><div className="grid grid-cols-7 gap-2">{Array.from({ length: 31 }, (_, i) => i + 1).map(day => <Label key={day} className="flex items-center justify-center gap-1 border p-2 rounded-md"><input type="checkbox" checked={value.monthDays?.includes(day) || false} onChange={() => onChange({ ...value, monthDays: toggle(value.monthDays || [], day) })} />{day}</Label>)}</div><p className="text-xs text-muted-foreground">Dates that do not exist in a month are skipped. For example, the 31st is skipped in April.</p></fieldset>}
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Email times</legend>{value.times.map((time, i) => <div key={i} className="flex items-center gap-2"><Input aria-label={`Email time ${i + 1}`} type="time" value={time} onChange={e => onChange({ ...value, times: value.times.map((t, n) => n === i ? e.target.value : t) })} /><Button type="button" variant="outline" disabled={value.times.length === 1} onClick={() => onChange({ ...value, times: value.times.filter((_, n) => n !== i) })}>Remove</Button></div>)}<Button type="button" variant="outline" disabled={value.times.length >= 24} onClick={() => onChange({ ...value, times: [...value.times, '18:00'] })}>Add another time</Button></fieldset>
      <p className="text-sm text-muted-foreground">Times follow this time zone, including daylight saving. A time skipped by the spring clock change moves forward by the gap; a repeated autumn time occurs once. Emails are sent by the next dispatcher run, normally within a minute.</p>
    </>}
    <p className="text-sm text-muted-foreground">Your full grace period starts at the due time. A later scheduled occurrence never resets a missed check-in or shortens its grace period. Complete an overdue check-in before changing its schedule or grace period. Checking in early keeps the next scheduled time.</p>
  </fieldset>;
}
