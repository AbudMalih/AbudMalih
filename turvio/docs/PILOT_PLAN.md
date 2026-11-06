# JARBOU pilot – from synthetic simulation to a small authorized pilot

## 1. Synthetic pilot (done, local)
`scripts/dev-stack.sh up --fresh --pilot` + `node e2e/pilot.mjs`: Hannover, 1 dispatcher, 5 drivers, 5 vehicles, 5 simultaneous tours with 54–96 stops (pickups with time windows, priorities), OR-Tools optimization on OSRM matrices (**synthetic street grid**, not real roads), publishing, parallel driver work with deliveries, failed/attempted deliveries with reasons, signatures, retried uploads and an offline batch replayed twice, dispatcher monitoring. Result of the last run (2026-11-06): 7/7 checks, 189 completed stops all visible to dispatch, 38 proofs stored exactly once, 19 stops of one tour correctly reported as not schedulable within the 6 h shift.

## 2. Blockers before real parcels
1. Device tests passed on the actual pilot phones (scanner, OCR, map, offline) – [DEVICE_TESTING.md](DEVICE_TESTING.md).
2. Hosted EU infrastructure + production checklist – [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).
3. Real OSRM extract and geocoder data.
4. Legal: DPA, DPIA, driver information, works council. JARBOU confirms that it is entitled to process the recipient data it enters; **no connection to DHL systems** and no DHL customer data unless DHL and JARBOU authorize it in writing.
5. MFA for administrative accounts; penetration test.

## 3. Staged real-world pilot
| Stage | Scope | Exit criteria |
|---|---|---|
| A – shadow (1 week) | 1 dispatcher + 2 drivers run TURVIO **in parallel** to the current process; JARBOU's own (non-carrier) deliveries only; no recipient contact data | no lost status updates; dispatcher sees progress within 1 min; drivers can scan ≥ 50 parcels/run without help |
| B – small live (2 weeks) | 5 drivers / 5 vans, Hannover, TURVIO is the working tool; old process as fallback | ≥ 98 % stops with a final status; proofs uploaded within 15 min of connectivity; no P1 incidents |
| C – depot (4 weeks) | all Hannover tours | optimization accepted by dispatch; support load acceptable |

Daily during the pilot: outbox backlog and rejected changes, optimizer/OSRM errors, crash reports, driver feedback. Weekly: retention job, access-log review, data minimisation check.

## 4. Rollback
TURVIO data stays exportable (tours/stops/proofs per day); drivers keep the previous paper/app process available during stages A and B.
