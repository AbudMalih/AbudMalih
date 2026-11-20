# Live tracking – legal and organisational requirements (not solved by code)

TURVIO provides technical controls; **passing tests does not make live tracking legally compliant.**
Before tracking real employees, JARBOU (controller) must complete the items below. This is a
checklist for the company and its advisers, not legal advice.

## Technical controls in TURVIO (after the stabilization sprint)
- Tracking off by default; company modes off / pilot (named drivers, max 20) / all drivers on tours;
  switching on needs a company admin with two-step verification and confirmation of prerequisites.
- Positions only while a tour is being driven (not before start, during a pause, after finishing).
- The driver must acknowledge the current notice before any position is accepted; a new notice
  version requires a new acknowledgement. Drivers can withdraw the acknowledgement in the app;
  tracking stops and the live position disappears at once. Acknowledgements and withdrawals are
  written to the audit log, as are tracking-switch changes and every track (history) view.
- Company notice texts: controller, data-protection contact, legal basis, additional text – shown to
  drivers with the standard notice (in the company's own wording; translate it yourself if needed).
- Retention: GPS history 30 days by default (configurable 1–365), live position at most 24 h;
  automatic purge. Paused tours show no position to dispatchers.
- Access: company and location scope enforced by the database; only roles with live-tracking
  permission see positions.

## Open requirements (company / legal)
1. **Legal basis and purpose** documented (e.g. § 26 BDSG / Art. 88 GDPR, Art. 6(1)) and entered in
   the notice texts (Settings → live tracking).
2. **Data protection impact assessment (DPIA, Art. 35 GDPR)** for systematic location monitoring.
3. **Works council** – co-determination for technical monitoring (§ 87(1) No. 6 BetrVG): agreement
   before tracking employees (also for the pilot, unless clarified otherwise).
4. **Information to drivers (Art. 13 GDPR)** in a language they understand: controller, contact,
   purpose, legal basis, retention, recipients, rights (access, rectification, erasure, objection),
   complaint to the supervisory authority. The in-app notice is short; hand out the full information.
5. **Acknowledgement ≠ consent.** If consent is chosen as legal basis, it must be voluntary in the
   employment context and withdrawable without disadvantage – document why.
6. **Records of processing (Art. 30)** and the **data processing agreement** with TURVIO (Art. 28),
   incl. sub-processors (hosting, Supabase, e-mail).
7. **Retention periods** confirmed (GPS 30 days default; proof-of-delivery photos/signatures 90
   days default – check commercial/contractual retention duties before the pilot).
8. **Store declarations** for background location (Google Play declaration with video, App Store
   review notes) – see `docs/STORE_READINESS.md`.
9. **Pilot procedure:** named drivers only, written information, contact person, how to withdraw
   (in the app or via the admin), review after the pilot.
