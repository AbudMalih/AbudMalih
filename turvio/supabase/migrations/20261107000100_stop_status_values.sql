-- Phase 4: additional stop outcomes. Separate migration because new enum
-- values cannot be used in the transaction that adds them.
alter type public.stop_status add value if not exists 'in_progress' after 'pending';
alter type public.stop_status add value if not exists 'attempted' after 'failed';
alter type public.stop_status add value if not exists 'rescheduled' after 'attempted';
alter type public.stop_status add value if not exists 'returned' after 'rescheduled';
