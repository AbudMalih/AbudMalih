===============================================================================
 JARBOU Logistik GmbH – Recruiting Command Center
 DHL Express Project
 INTERNAL USE ONLY – contains personal data of candidates (DSGVO / GDPR)
===============================================================================

An offline recruiting & onboarding dashboard. It runs entirely in your web
browser on this computer. No server, no installation, no internet connection
and no external services are required. No candidate data ever leaves the
computer.


FOLDER CONTENTS
---------------
  jarbou-recruiting/
    index.html            <- open this file to start the application
    README.txt            <- this file
    css/app.css           <- design / layout
    js/                   <- application code (all local, no external libraries)
      util.js, config.js, db.js, logic.js, ui.js, io.js, print.js,
      form.js, profile.js, app.js
      views/              <- one file per page (dashboard, candidates, …)
    assets/               <- JARBOU logo, icon

  Keep the folder together. Do not move index.html out of the folder.


-------------------------------------------------------------------------------
1. HOW TO OPEN THE APPLICATION
-------------------------------------------------------------------------------
  Windows:  double-click  index.html  (or right-click > Open with > Chrome/Edge)
  Mac:      double-click  index.html  (or right-click > Open With > Chrome/Safari)

  Recommended browsers: Google Chrome or Microsoft Edge (latest version).
  Firefox and Safari also work.

  Tip: bookmark the page (Ctrl+D / Cmd+D) so you always open the SAME file in
  the SAME browser – this matters for where data is stored (see section 2).

  On first start the application loads the two initial candidates
  (JRB-0001 Riber Isso, JRB-0002 Abdalrazaq Al Shaer).


-------------------------------------------------------------------------------
2. HOW DATA IS STORED
-------------------------------------------------------------------------------
  - Data is saved automatically, immediately after every change, in the
    browser's built-in database (IndexedDB) on this computer.
  - Data stays after closing the browser, restarting or shutting down.
  - Data is stored PER BROWSER and PER COMPUTER. Chrome and Edge on the same
    PC do NOT share data. Another colleague's PC does NOT see your data.
  - Some browsers (e.g. Firefox) also tie the data to the folder location of
    index.html. If you move or rename the folder, the application may start
    empty – restore your latest backup in that case (section 6).
  - Deleting "browsing data / cookies & site data" in the browser settings
    DELETES THE DATABASE. Private/Incognito windows do not keep data.
  => Therefore: make regular backups (section 5). The dashboard reminds you
     when no backup was made for 7 days (configurable in Settings).


-------------------------------------------------------------------------------
3. HOW TO ADD CANDIDATES
-------------------------------------------------------------------------------
  - Click the red "+ Add Candidate" button (top right, on every page).
  - Only First Name and Family Name are required. Everything else can be
    completed later – unknown information simply shows as "Pending".
  - Sections: Personal Information, Employment, Recruitment, Notes.
  - Press "Create Candidate" (or Ctrl+Enter). The candidate receives an ID
    (e.g. JRB-0003) and the profile opens automatically.
  - Possible duplicates (same name or phone number) are detected and you are
    asked before a second record is created.


-------------------------------------------------------------------------------
4. HOW TO EDIT CANDIDATES
-------------------------------------------------------------------------------
  - Click any candidate (table row, pipeline card, dashboard item) or use the
    search box at the top (Ctrl+K) to open the candidate profile.
  - "Edit" changes personal, employment and recruitment details.
  - Tabs in the profile:
      Overview    – readiness (availability vs. administrative), warnings
      Documents   – status of every document (Missing / Requested /
                    Received / Verified / Not Required) + issue/expiry dates
      Contract    – Not Started > Preparing > Prepared > Sent > Signed >
                    Completed, plus type, salary, hours, dates
      Onboarding  – checklist (tick steps; two steps are automatic)
      Activity    – timeline; log calls, WhatsApp, emails, meetings
      Notes       – internal notes and dated notes
  - Changes in the Documents / Contract / Onboarding tabs save instantly.
  - Recruitment Pipeline: drag a card to another column, or use "Move…".

  IMPORTANT – READINESS:
  "READY TO START" requires BOTH:
    a) Candidate availability = Ready (willing to start), AND
    b) Administrative readiness = all required documents received/verified,
       contract signed, phone, start date, station and employment type recorded.
  Moving a candidate to the "Ready" pipeline column does NOT make them
  administratively ready. Residence / work permit can be set to
  "Not Required" per candidate where not applicable.

  Archive instead of delete: "Archive" (with reason) removes a candidate from
  active lists; they can be restored at any time from the Archive page.
  Permanent deletion is only possible from the archive and requires typing
  DELETE to confirm.


-------------------------------------------------------------------------------
5. HOW TO CREATE BACKUPS
-------------------------------------------------------------------------------
  - Dashboard > "Backup Database"  or  Settings > Backup > "Backup Data".
  - A file named  jarbou-recruiting-backup_YYYY-MM-DD_HHMM.json  is
    downloaded (usually into your Downloads folder). It contains ALL
    candidates, documents, notes, activity history and settings.
  - Move the file to a secure, access-restricted location (e.g. the company
    file server or an encrypted USB drive). Do NOT e-mail it unencrypted.
  - Recommended: at least once per working day / after larger changes.
  - "Last Backup" date and time are shown in Settings.


-------------------------------------------------------------------------------
6. HOW TO RESTORE BACKUPS
-------------------------------------------------------------------------------
  - Settings > Backup, Import & Export > "Restore Backup…"
  - Choose a .json backup file.
  - The application shows the backup date and number of candidates and warns:
        "This will replace the current local database."
  - By default a safety copy of the CURRENT data is downloaded first.
  - Confirm with "Replace database".


-------------------------------------------------------------------------------
7. HOW TO EXPORT DATA
-------------------------------------------------------------------------------
  - Candidates page > "Export":
        Current view (respects search & filters)  – CSV / Excel / JSON
        All candidates incl. archive              – CSV / Excel
        Print list / PDF
  - Settings > Export: all candidates as CSV, Excel (.xlsx) or JSON.
  - CSV files use semicolons and UTF-8 so that German Excel opens them with
    correct columns and umlauts. The .xlsx file opens directly in Excel.
  - Printing / PDF: use "Print" in a candidate profile (candidate summary),
    "Print overview" on the dashboard, "Print report" on Reports or
    "Print list" on Starting Soon. In the print dialog choose
    "Save as PDF" as the printer to create a PDF.
    Tip: disable "Headers and footers" in the print dialog for a clean PDF.


-------------------------------------------------------------------------------
8. HOW TO MOVE THE APPLICATION TO ANOTHER COMPUTER
-------------------------------------------------------------------------------
  1. On the OLD computer: Settings > "Backup Data" (download backup file).
  2. Copy the whole  jarbou-recruiting  folder AND the backup file to the new
     computer (e.g. via USB drive or company network share).
  3. On the NEW computer: open index.html in Chrome/Edge.
  4. Settings > "Restore Backup…" > choose the backup file > confirm.
  5. Check that the candidate count is correct, then securely delete the
     backup copy from the USB drive if it is no longer needed.

  Note: two computers do NOT synchronise automatically. Decide which computer
  is the "master" and always move data via backup/restore.


-------------------------------------------------------------------------------
9. IMPORTANT PRIVACY CONSIDERATIONS
-------------------------------------------------------------------------------
  - The application contains personal data (names, contact details, salary,
    documents status, notes). Use it for internal recruiting purposes only.
  - It makes NO network connections and loads NO external scripts, fonts or
    services. All data stays in this browser on this computer.
  - Protect the computer with a password and lock the screen when away
    (Windows+L / Ctrl+Cmd+Q).
  - Use a personal Windows/Mac user account – anybody using the same browser
    profile can open the data.
  - Backup and export files contain the full personal data: store them only
    in access-restricted locations, never in private cloud storage or
    unencrypted e-mails, and delete old copies you no longer need.
  - Delete or archive candidates who are no longer relevant, according to
    JARBOU's data-retention policy (DSGVO). Permanent deletion: Archive page.
  - Do not record unnecessary sensitive data in free-text notes.


-------------------------------------------------------------------------------
10. HOW TO UPDATE THE APPLICATION WITHOUT LOSING DATA
-------------------------------------------------------------------------------
  The recruitment data is NOT stored in the application files – it is stored
  in the browser. Replacing the files therefore does not delete data, as long
  as you follow these steps:

  1. Create a backup first (Settings > "Backup Data"). Always.
  2. Close the application tab.
  3. Replace the files INSIDE the existing  jarbou-recruiting  folder with the
     new version (same folder name, same location). Do not rename or move the
     folder.
  4. Open index.html again in the SAME browser. Your data appears as before.
  5. If the application starts empty (e.g. because the folder was moved or a
     different browser was used): Settings > "Restore Backup…" with the
     backup from step 1.

  Never use "Clear browsing data" or "Erase local database" as part of an
  update.


-------------------------------------------------------------------------------
QUICK REFERENCE
-------------------------------------------------------------------------------
  Ctrl+K / Cmd+K     Find a candidate from anywhere
  Esc                Close profile / dialog
  Ctrl+Enter         Save the candidate form / add a note or activity
  Top bar selector   Focus on one project (multi-project ready)
  Settings           Company name, required drivers (target), stations,
                     projects, positions, recruiters, sources, document
                     requirements, onboarding checklist, backup reminder

  Version 1.0.0
===============================================================================
