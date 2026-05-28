# WABS Changelog

## v1.0.0-beta.5
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.5

### 🚀 Major New Features
*   **Combined Scan:** Added combined scan to optimize performance of indexing and scanning of faces and objects.
*   **Portable Data Export:** Added JSON Export/Import tools for Known People and Object/Custom Tags. Includes a Smart Path Fallback Matcher so tags survive drive letter changes and migrations.
*   **People Timeline:** Added chronological Timeline View and "Full Archive Timeline" jump integration directly into the People Photos page.
*   **Document Thumbnails:** Added thumbnail support for `.doc` and `.docx` files.
*   **Smart Search UI:** Improved the user interface for Smart Search.
*   **People Management:** Improved renaming people and handling person mismatches.
*   **Advanced JSON Search:** Added high-speed JSON prefix searches (`camera:`, `resolution:`, `fps:`, `artist:`, `album:`, `genre:`, and `meta:`) utilizing SQLite's JSON1 extension for native metadata querying.

### ✨ UI/UX Enhancements
*   **Data Management:** Completely redesigned the Data Management section in Settings with clean, descriptive UI cards.

### 🛠 Build & CI
*   **Raspberry Pi Build:** Added a Raspberry Pi build target in GitHub Actions.
*   **Build Selection:** Added UI to pick the build target when running workflows manually.

### 🐞 Bug Fixes & Performance
*   **Database Cleanup & Optimization:** Added a dedicated routine in Settings to scan for missing files, remove dead links, purge orphaned AI profiles, and vacuum the SQLite databases to reclaim disk space.
*   **OOM Memory Optimizations:** Resolved severe backend Out-Of-Memory crashes and SQLite lock contentions when scanning massive archives (>90,000 files) by implementing batched `.yield_per()` queries and ID-level tracking.
*   **Connection Stability:** Fixed backend HTTP connection drops (`[WinError 10054]`) during rapid frontend scrolling using `AbortController` network cancellation.
*   **Database Limits:** Fixed fatal SQLite `OperationalError` crashes during bulk tagging by circumventing the hard 999 `IN(...)` variable limit.
*   **Pagination:** Added robust pagination to the People Photos API to prevent browser freezing on profiles with thousands of matched faces.
*   **Duplicates Navigation:** Fixed UI bugs when navigating away from the Duplicates page.
*   **Batch Processing:** Fixed issues with re-applying batch processing.
*   **UI Scaling:** Fixed UI scaling issues when resizing the details pane.
*   **Selection Display:** Fixed an issue where the app was not showing selected files.
*   **CPU Drain Fix:** Fixed a major bug where stopping the standalone face scan would fail to terminate the background loop, causing indefinite high CPU usage.
*   **Vectorized AI Engine:** Completely replaced slow Python math loops with optimized `numpy` vector and matrix multiplications for face clustering and similarity searches, dropping computation times from minutes to milliseconds.
*   **Massive Database Speedups:** Bypassed heavy SQLAlchemy ORM instantiation overhead in indexer, search, and duplicate hasher routines. Integrated `bulk_update_mappings` and raised batch commit thresholds from 50 to 500 for lightning-fast database writes.
*   **FTS5 Search & SQLite Tuning:** Enabled WAL mode for improved concurrency, heavily optimized FTS5 trigger scoping to slash unnecessary disk I/O, and added Porter stemming and prefix tokenization for highly accurate partial filename matches.
*   **JSON1 Hasher Optimization:** Upgraded the background lazy hasher to use SQLite's native `json_extract` filtering, completely preventing already-verified files from being unnecessarily loaded into memory.

## v1.0.0-beta.4
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.4

### 🚀 Major New Features
*   **Advanced Search Operators:** Added support for explicit boolean search operators `+` (Require/Match All) and `-` (Exclude) to allow fine-grained filtering (e.g., `+object:car -tag:blur`).
*   **Similar Face Detection:** Introduced the ability to find and merge similar unknown faces directly into an existing person's profile.
*   **Face Profile Merging:** Added the ability to manually merge multiple face profiles into one for improved face detection organization.
*   **Data Export & Backup:** Added a new "Export / Backup Data" feature in Settings to easily create a safe, portable copy of your databases and configuration.
*   **Full Archive Timeline:** Added an option to display the complete chronological timeline of your entire archive in the Explorer and Search views.

### ✨ UI/UX Enhancements
*   **Settings UI Reorganization:** Completely overhauled the Settings page into a clean, tabbed interface (General, UI Preferences, AI & Vision, Backups, Smart Searches) for much easier navigation.

### 🐞 Bug Fixes & Performance
*   **Dashboard Statistics:** Corrected the "Known People" and "Unknown People" counts on the dashboard to accurately reflect unique individuals instead of total face appearances.
*   **Logging Support:** Add logs for critical failures to help debug issues. This can be enabled in Settings UI.

## v1.0.0-beta.3
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.3

### 🚀 Major New Features
*   **People (Face Recognition):** An entirely new feature utilizing local ML/AI models to detect faces, automatically group them by person, and allow you to browse all photos of a specific individual.
*   **Tags (Object Classification):** An entirely new feature utilizing local ML/AI models to automatically classify objects and scenes in photos, enabling powerful keyword searches.
*   **Smart Searches:** You can now save your most-used complex search queries (e.g., `type:video length:>1h`) as one-click shortcuts. These are configurable in Settings and appear in the Search view for quick access.
*   **Advanced Search Operators:** The search bar is now significantly more powerful, supporting relational operators (`size:>1GB`, `length:<30s`) and date ranges (`date:2020-2022`).
*   **Global Tag Management:** The new dedicated "Tags" page now includes tools to manage your metadata globally. You can delete a specific tag from every file in the archive or clear all AI-generated `object:` tags at once.
*   **AI Detection Sensitivity:** New dropdowns in the Settings page allow you to fine-tune the accuracy of the AI models for Face Detection, Face Clustering, and Object/Scene Classification independently.

### ✨ UI/UX Enhancements
*   **Dashboard & Settings Redesign:** Updated the Dashboard with new feature tiles and modernized the Settings UI with a clean, card-based layout.
*   **Dedicated Tags Page:** The "Detected Objects & Scenes" section has been migrated from the dashboard to its own dedicated, searchable, and paginated page, dramatically improving dashboard load times for large archives.
*   **People Page Pagination:** The "Named Persons" and "Unknown Persons" sections are now paginated, preventing browser freezes when viewing thousands of profiles. Pagination controls are available at both the top and bottom of each section.
*   **"Locate in Explorer" Feature:** A new button in the person photos view allows you to instantly find a specific photo within the main Explorer timeline, showing its context with other files from the same day.
*   **Real-time Progress Indicators:** All background tasks (Hashing, Face Scanning, Object Scanning) now show detailed progress bars and display the name of the file currently being processed.
*   **Intelligent Resuming:** The Object & Scene scanner now intelligently resumes where it left off, skipping previously tagged photos.
*   **Manual Tagging Auto-Complete:** The "Manage Tags" input now provides auto-complete suggestions based on your existing tags.
*   **Quality of Life:** Renaming a person now automatically selects the full name for faster editing.

### 🐞 Bug Fixes & Performance
*   **Major Performance Boost:** Drastically improved application startup time and background polling responsiveness by removing a heavy, unpaginated network request from the main dashboard loop.
*   **UI Stability & Responsiveness:** Fixed unresponsive "Stop" buttons, blank Settings/Tags pages, and browser freezes on the People page.
*   **Robust Polling & Caching:** Implemented exponential backoff for API polling and fixed browser caching issues that prevented real-time dashboard updates.
*   **Search Engine Fixes:** Corrected the `date:` search filter and improved the `size:` filter logic.
*   **Duplicate Sorting:** Fixed bugs in sorting updated duplicate files.
*   **Configuration Resilience:** The backend now generates a complete default `config.yaml` on first run and gracefully handles legacy database file paths to prevent startup errors.

---

## v1.0.0-beta.2
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.2
### 🐞 Bug Fixes
*   **Performance:** Fixed a major performance bottleneck that caused slow startup and UI lag during background tasks.
*   **UI Stability:** Fixed unresponsive "Stop" buttons, blank Settings/Tags pages, and incorrect dashboard face counts.
*   **Robustness:** Implemented exponential backoff for API polling to handle network drops and fixed browser caching issues.
*   **Search:** Corrected the `date:` search filter to query modification dates properly.
*   **Configuration:** The backend now generates a complete default `config.yaml` on first run to prevent startup errors.

### ✨ New Features & Enhancements
* **Lightning-Fast Full-Text Search (FTS5):** Re-engineered the database search architecture to leverage SQLite's FTS5 extension. WABS now uses a shadow virtual table to provide instant search results across hundreds of thousands of files.
* **Search Autocomplete & Spell-Check:** Added real-time search suggestions powered by the `fts5vocab` table. The search bar now instantly provides prefix-matching auto-completions, as well as fuzzy "Did you mean?" suggestions for misspelled queries using Python's `difflib`.
* **Multi-Archive Support:** You can now configure, index, and manage an unlimited number of parallel backup drives and network shares simultaneously from the Settings menu.
* **Advanced Data Safety:** Introduced both Global and Per-Location Read-Only modes to protect specific archives from accidental destructive operations (Move/Delete).
* **Multi-Archive Path Remapping:** The API server now seamlessly translates missing indexed paths across multiple configured backup locations if you migrate your archives to new drive letters.
* **Selection Filtering (UI):** Added a "Show Selected Only" toggle to the selection action bar, allowing you to instantly isolate and review your checked files before performing bulk actions.
* **Read-Only Badges (UI):** Added intuitive "Read-Only" (RO) badges directly to file cards in both Grid and List views to clearly indicate which files are protected.
* **Settings Page Improvements (UI):** Added a highly visible "Save Settings" button to the top header of the Settings page so you no longer have to scroll to the bottom.

### 🐛 Bug Fixes
* **Path Matching:** Fixed an issue where per-location Read-Only protections would fail to hide the Delete/Move buttons due to operating system path separator inconsistencies (`\` vs `/`).

### 📖 Documentation Updates
* **Architecture:** Updated `ARCHITECTURE.md` to explicitly detail the **SQLite FTS5** integration (Virtual Tables & Autocomplete) and the **Lazy Hasher** (Chunked SHA-256 background duplicate verification process).

---

## v1.0.0-beta
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta

- **Initial Release** of WABS (WiZarD's Archival and Backup Search System).
- **100% Offline Capable**: Removed internet dependencies. Uses local Material UI icons, native fonts, and local SVG placeholders.
- **Smart Indexer**: Categorizes photos, videos, documents, compressed files, installers, and binaries with EXIF extraction.
- **High-Performance Search**: Optimized SQLite queries with batch commits and database streams for handling millions of files.
- **Customizable Workspace**: Draggable, resizable UI panes (Sidebar, Timeline, Details) with persistent state saving.
- **Explorer Enhancements**:
  - Grid and List view modes.
  - Advanced multi-selection (Shift+Click, Ctrl+Click, Checkboxes).
  - Batch actions to Copy, Move, Delete, and Open selected files.
  - Scrollable timeline grouping files chronologically.
- **Media Previews**: Native video frame extraction for `.mp4`, `.mkv`, and `.avi` files using OpenCV.
- **Dashboard & Settings**: Live indexing statistics, system native file-chooser integration, and archive overview.
