-- Tour lifecycle (Phase B), part 1: new enum values.
-- Separate file: a value added with ALTER TYPE cannot be used in the same transaction.
-- Additive only. Old clients never receive these values: the driver feed and the
-- default Dispatch payload filter cancelled tours and cancelled stops (see API).

-- A tour stopped by Dispatch before it was done. Distinct from 'completed' (finished)
-- and from withdrawing (unpublishing a tour that has not started).
alter type public.tour_status add value if not exists 'cancelled';

-- A stop Dispatch decided not to serve, with a reason. Closed (not open), kept as a record.
alter type public.stop_status add value if not exists 'cancelled';
