# Sprint 13.1 Completion — Availability, Appointment & Calendar

Starting SHA: `b3995317ebd907deee61e5aa5c1f6e04e52a6041`

Implementation SHA: recorded by the commit containing this report.

Delivered an additive Appointment, availability-rule, availability-exception, and calendar-sync schema/migration; deterministic timezone/DST-aware slot calculation; conflict-safe internal booking; duplicate-safe booking, cancellation, and rescheduling with audit and outbox effects; an optional busy/mirror provider contract with honest no-op fallback; client scheduling/current appointment APIs; consultant calendar/detail/availability APIs; and functional PORTAL-28, CRM-26, and CRM-27 routes.

Internal Appointment remains canonical. External failure cannot remove or cancel it, and client projections do not include external event details. Booking revalidates current approved Strategy, assignment, slot availability, and overlap inside the command path. PostgreSQL exclusion and partial unique indexes protect concurrent bookings.

Focused proof: 2/2 scheduling unit tests (DST conversion and provider fallback), all-workspace typecheck, API build, web production build, repository lint, Prisma generation, and successful deployment of the complete 51-migration Credit-only chain through `20260903200000_phase13_1_appointments`. Phase 13.2–13.5 behavior was not pulled forward.
