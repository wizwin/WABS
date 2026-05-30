# WABS Changelog

## v1.0.0-beta.6
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.6

### 🚀 Major New Features
*   **Cluster Unknowns:** Added a powerful new "Cluster Unknowns" feature on the People page. It allows you to instantly compare Unknown Persons against other Unknown Persons and automatically merges them if they meet your configured Similarity Threshold, significantly reducing clutter before you assign names.
*   **Reclassify Unknowns:** Added a powerful new "Reclassify" feature that breaks apart wrongly-clustered Unknown profiles and re-evaluates every single face against all Named profiles and other Unknowns using your current Similarity Threshold. This allows you to effortlessly correct profiles that were grouped with the wrong threshold settings!
*   **Hidden People:** Added the ability to explicitly "Hide" specific Known or Unknown people from the UI and Search Auto-Suggest. Hidden profiles are kept in the database to prevent the AI from repeatedly rescanning them.
*   **Video Date Extraction:** Added native video container date parsing (`creation_time`, `\xa9day`) via `mutagen`. Video files now map perfectly into the chronological timeline alongside your photos.
*   **Video Tag Parsing:** Added support for extracting native video metadata tags via `mutagen` for enriched searchability.
*   **Person Previews:** Selecting an unknown profile now displays a helpful sample grid of their photos in the Details pane, ensuring you know exactly who you are managing before merging.
*   **Light & Dark Theme Support:** Full application theme toggling added to Settings, utilizing a highly-efficient CSS inversion approach that perfectly preserves media and icon colors.
*   **Auto-Pick Cover Photo:** A new smart UI button that automatically evaluates bounding box sizes and Laplacian variance (sharpness) across a person's photos to pick the best possible thumbnail.
*   **Purge Small Unknowns:** A dedicated database management routine in Settings allowing you to instantly delete noisy "Unknown Person" profiles that contain fewer than a specified number of photos.
*   **Direct Move to Person:** You can now select specific photos from any profile (or Unknown group) and instantly reassign them to another named person via a convenient UI dropdown.

### ✨ UI/UX Enhancements
*   **Undo Action for Tagging:** Added an intuitive "Undo" button to the Toast notifications, allowing you to instantly reverse accidental photo assignments, removals, or profile moves.
*   **Live Chunked Progress Bars:** Re-engineered the frontend to send bulk AI operations in safe chunks of 250 profiles. This prevents HTTP connection timeouts on massive 30,000+ databases and provides a smooth, real-time progress bar for the user.
*   **Long-Running Task Cancellations:** Added the ability to gracefully cancel massive AI clustering or reclassification tasks midway. The UI dynamically switches the action buttons to "Cancel" during processing.
*   **AI Actions Menu:** Grouped all advanced similarity sliders, clustering, and purge operations into a clean, collapsible "AI Actions" panel to keep the main People UI uncluttered.
*   **Data Management Tab:** Reorganized Settings to feature a dedicated "Data Management" tab, cleanly grouping your DB Cleanup, Export/Backup, JSON tools, and Cache clearing operations.
*   **Intelligent Scroll Memory:** Navigating back to the People page from a specific person's photo grid now automatically snaps you back to your exact scroll position and active page.
*   **Thumbnail Debouncing:** Added a 250ms Javascript debounce wrapper to face thumbnails. Rapidly paginating through the People grid no longer hammers the backend with hundreds of queued OpenCV tasks!
*   **Smooth Fade-ins:** Replaced harsh image placeholders with a smooth CSS opacity fade-in once face thumbnails finish loading.
*   **Animated Operation Spinners:** Added real-time animated hourglass spinners and text updates to the Database Cleanup and Backup buttons to clearly indicate active synchronous operations.
*   **Date Normalization:** Robust parsing and normalization of EXIF and modified dates for flawless chronological sorting and Timeline grouping, overcoming browser-specific date parsing inconsistencies.
*   **Similar Faces Pagination & Sorting:** The "Find Similar Unknowns" panel now supports pagination (500 profiles per page) and intelligently sorts ties by matching the photo counts and directory/time context.
*   **Lightning-Fast Thumbnails:** Replaced artificial JavaScript load delays with native HTML lazy-loading and aggressive backend `Cache-Control` headers, instantly snapping thumbnails into view from browser memory.
*   **Refined Similarity Threshold:** Adjusted the default Cosine Similarity threshold to 55% (and lowered the slider minimum) to drastically improve matching on side-profiles and diverse lighting.
*   **Streamlined Details Pane:** Removed unused UI elements and added sleek, globally available spinning loading animations.

### 🛠 Build & CI
*   **Windows Executable Polish:** The GitHub Actions Windows build now automatically uses the `--noconsole` flag (hiding the background command prompt) and utilizes per-matrix icon embedding for a custom application icon (`.ico`).
*   **ARM Compatibility:** Switched the GitHub Actions ARM build runner to `ubuntu-22.04` for enhanced build stability and compatibility.

### 🐞 Bug Fixes & Performance
*   **LRU Exemplar Matrix Cache:** Implemented a highly optimized, thread-safe memory cache that builds a curated 25-photo baseline for each person. It dramatically improves AI accuracy by dropping blurry outliers and speeding up matrix multiplications.
*   **Dynamic Cache Invalidation:** The similarity caches are now explicitly invalidated and recalculated instantly whenever you rename, merge, delete, or manually tag a person.
*   **React O(N²) Render Bottleneck:** Fixed a catastrophic browser freeze when selecting thousands of unknown profiles by replacing inline array `.find()` and `.sort()` operations with highly optimized O(1) Hash Maps and strict memoization.
*   **Comprehensive Backend Logging:** The backend now fully logs summary statistics for all Bulk AI operations (Auto-Pick Cover, Merges, Clusters, Reclassifications) to the `wabs.log` file when Background Logging is enabled.
*   **Theme-Aware SVG Placeholders:** The backend now dynamically generates offline text and document preview SVGs based on your active UI theme, fixing invisible black text in Light Mode.
*   **Thread-Safe Components:** Bulletproofed backend memory structures to handle rapid UI clicks without triggering concurrent mutation crashes.
*   **Vectorized AI Similarity:** Replaced slow native Python math loops with highly optimized `numpy` vector operations for cosine similarity, slashing face clustering times.
*   **Database Synchronization & Ghost Faces:** Fixed a major bug where the `ai_metadata.db` retained "ghost" faces for files that were moved or deleted. The `System Cleanup` routine now flawlessly cross-references the main database and completely purges all orphaned AI records.
*   **Scanner Commit Bug:** Fixed a catastrophic indentation bug in the unified scanner loop where the final batch of database commits (up to 499 files) was rolled back, resulting in missing index records and `404: Image not found` errors.
*   **Group Photo Speedup:** Added a 98% match early-exit optimization for face thumbnail extraction. The backend no longer wastes computationally expensive AI cycles checking every single face in massive group photos once the target person is found.
*   **Pillow (PIL) Media Fallbacks:** Added robust Pillow fallback logic to both the large photo caching routine and the face cropper (improving person thumbnail fallbacks), completely fixing missing thumbnails for modern formats (like `.webp`) that OpenCV silently fails to decode.
*   **Orphaned Thumbnail Cleanup:** The `System Cleanup` routine now explicitly scans and deletes orphaned physical `.jpg` thumbnails from the `.wabs_cache` disk directories to reclaim space (and returns the exact deleted thumbnails count for UI feedback).
*   **Start Scan In-Memory Optimization:** The Indexer now pre-fetches all existing file paths into a Python `set` when starting a scan. O(N) database queries have been replaced with O(1) in-memory lookups, drastically speeding up indexing.
*   **Directory Exclusions:** The Indexer now actively respects global and per-backup exclusion lists during the initial `os.walk` directory traversal, and actively removes missing or newly excluded DB entries on update-only scans.
*   **Explorer Timeline Dates:** Fixed an issue where the timeline grouped migrated files by their OS `modified` timestamp instead of their true EXIF `DateTimeOriginal` metadata.
*   **Photo Cache Optimizations:** Reduced the dimensions of cached photo thumbnails from `800x800` to `400x400`, saving 75% more disk space and browser RAM without losing visual quality. Also fixed a bug where caching settings changes were ignored.
*   **Hasher Progress Bar:** Restored missing progress state tracking in the Lazy Hasher. The UI now properly displays the hashing progress bar and automatically refreshes the Duplicates page with green verification ticks upon completion.
*   **Dashboard Counts:** Fixed the Dashboard `/stats` endpoint to dynamically read the configuration and correctly subtract "Hidden" profiles from the Known/Unknown totals.
*   **Indexer Resuming:** Fixed resume logic where removing an exclusion and clicking 'Start' would fail to scan the newly un-excluded folders due to stale pagination caching.
*   **Config UI Parsing:** Flattened legacy nested `ui_preferences` in the configuration file so settings like Animations and Cache limits save and load correctly.
*   **Documentation:** Updated README with CPU-limiting environment variable instructions to help users throttle background threads on lower-end devices like the Raspberry Pi.

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
*   **Import/Export Progress:** Added progress bars with cancellation support for all People and Tag import operations in the Data Management settings.
*   **Import Safeguards:** The UI now displays a confirmation warning before importing data into a non-empty database to prevent accidental duplication.
*   **Data Management:** Completely redesigned the Data Management section in Settings with clean, descriptive UI cards.

### 🛠 Build & CI
*   **Raspberry Pi Build:** Added a Raspberry Pi build target in GitHub Actions.
*   **Build Selection:** Added UI to pick the build target when running workflows manually.

### 🐞 Bug Fixes & Performance
*   **Critical Import Performance:** Fixed a major performance bottleneck where importing large JSON files would hang the backend. Tag application is now performed in massive batches using `bulk_update_mappings`, reducing import times from minutes to seconds.
*   **Database Integrity & Stability:**
    *   Hardened the AI database schema with `UNIQUE` constraints to programmatically prevent duplicate people and face embeddings.
    *   Upgraded all merge, rename, and delete operations (`rename_person`, `delete_person`, `merge_people`) to be fully compatible with the new constraints, preventing crashes on conflicting data.
    *   Fixed a critical bug where the AI scanner could crash after deleting people by implementing a robust "Unknown Person" ID counter.
*   **Robust Tagging Engine:**
    *   Eliminated a subtle bug where manually adding or removing a person from a photo could fail if another person with a similar name was also tagged (e.g., "Ben" vs. "Benjamin"). All tag operations now use strict set-based logic.
    *   Fixed a fatal `IndentationError` in the `import-tags` API endpoint.
...
*   **Optimized Bulk Operations:** Refactored the `delete_person` and `rename_person` endpoints to use optimized bulk updates, preventing crashes and ensuring instant tag removal/updates even on profiles with thousands of photos.
*   **Schema Consistency:** Unified the AI database schema creation to eliminate redundant error handling and improve overall code reliability.
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
