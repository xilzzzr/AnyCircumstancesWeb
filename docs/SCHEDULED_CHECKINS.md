# Daily / scheduled check-in

The existing daily paid tier now includes calendar scheduling without changing its
billing identifier (`daily`), price, or existing subscribers' timing. Scheduling is
opt-in under Verification Settings. Weekly and monthly tiers cannot enable it,
including by making direct API requests.

Choose every 1–365 calendar days, selected weekdays every 1–52 weeks, or selected
month dates, with 1–24 email times and an IANA time zone. Start date anchors the
recurrence; weeks begin Monday. Missing dates (such as February 31) are skipped.
DST gaps move forward by the gap; repeated times occur once at the first instant.

The first reminder is sent at the due time by the existing dispatcher, normally
within a minute. The existing reminder count includes this first email. The full
6–72 hour grace period begins at the due time, independently of recurrence.
Additional scheduled occurrences never reset an unanswered due time. Only a
successful PIN check-in advances it. An early check-in keeps the next calendar
occurrence; a late check-in advances to the next future occurrence without
shifting the calendar's anchor. Users must complete overdue check-ins before
changing the schedule or grace duration. Reminder-only saves and GET requests
preserve the due time. Settings and check-ins lock the same row as emergency
release to serialize changes. Plan downgrades clear custom recurrence and keep
an outstanding due time; the next check-in uses the new plan interval.

Accounts now store an optional display name. New web signups request it, and
existing users can add it in Account Settings. Recipient subjects and bodies
identify the owner; accounts without a name use the email address as the subject
fallback. Names are escaped in HTML, limited to 120 characters, and reject header
control characters. No secret vault data is included in the subject.

## Deploy

From `/srv/uac-web`, after merging and pulling this change:

```sh
npm ci
npm ci --prefix backend
npm run migrate:scheduled-checkins --prefix backend
npm run build
pm2 restart uac-backend --update-env
```

Run the migration before restarting the backend or dispatcher with the new code.
It adds nullable columns without modifying existing due times, grace periods, or
names, and is safe to repeat. `backend/20261022_scheduled_checkins.sql` is the
one-time SQL equivalent if migrations are applied manually instead.

Keep the existing dispatcher running every minute. If it is a persistent PM2
process, restart it after migration too; if using the included systemd timer,
each invocation reads the new code. No live email, database migration, or server
restart was performed during implementation.

## Validation

Run `npm test --prefix backend`, `npm test`, `npx tsc --noEmit -p tsconfig.app.json`,
and `npm run build`. Tests cover recurrence, DST, leap dates, timezone offsets,
API entitlement enforcement, preserving open grace periods, legacy clients,
owner subjects, email contrast, and the repeatable migration.

Production SQL/SMTP integration must be checked in staging. Email styling uses
inline white text and keeps dark text on the light action button; individual
mail clients can still apply their own color transformations.
