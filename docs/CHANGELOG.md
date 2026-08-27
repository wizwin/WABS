# WABS Changelog

## v1.2.1

### 🐞 Bug Fixes & Refinements
*   **Drive Connection Utilities & Fast Disconnected Root Exclusion:** Added reusable path and drive verification utilities (`get_connected_backup_locations`, `is_path_connected`) in `paths.py`. During post-index face thumbnail pre-caching (`STATE["status"] = "Caching face thumbnails..."`), WABS checks mounted drives and connected backup roots in bulk once in $O(1)$ time, instantly skipping people whose photos reside on disconnected external backup drives (e.g. `M:\`) in memory without executing slow per-file disk existence checks across millions of database records.
*   **Offline / Disconnected Drive Face Thumbnail Error Handling:** Added accessibility checks and handled `(FileNotFoundError, OSError, PermissionError)` in `get_person_thumbnail` and background face cache warming. If an image is missing or a drive is disconnected mid-operation, WABS logs an informative single-line warning instead of dumping multi-page exception tracebacks into the application log, gracefully serving standard placeholder previews.
*   **Virtual Folder Orphan Cleanup Lock Contention Fix:** Removed destructive `cleanup_orphans()` SQL `DELETE` write queries from the read-only `GET /virtual-folders` and `POST /virtual-folders` endpoints. Orphan cleanup is now strictly executed on mutating deletion endpoints (`DELETE /virtual-folders/{folder_id}`), preventing `sqlite3.OperationalError: database is locked` errors during background indexer and scanner operations.

## v1.2.0

### 🚀 Major New Features & Enhancements
*   **Enhanced AI-Enabled Natural Language Search Assistant:** Comprehensively upgraded the AI search translation engine (`/system/generate-search`) to translate complex natural language requests into precise WABS search queries across all media and file formats:
    *   **People & Multi-Person Groups:** Detects individuals (`person:"John Doe"`), multi-person co-occurrences (`person:Alice person:Bob`), and multi-value comma lists (`person:Alice,Bob`).
    *   **Relationships, Kinship & Social Circles:** Integrates social and relationship taxonomies (`rel:spouse`, `rel:sister`, `rel:child`, `rel:parent`, `rel:father,mother`, `category:family`, `category:friends`).
    *   **Food & Objects:** Identifies food and drink items (`object:pizza`, `object:cake`, `object:sushi`, `object:coffee`, `object:dinner`, `object:breakfast`) and objects/scenery (`object:car`, `object:dog`, `object:beach`, `object:mountain`).
    *   **Locations & Geographic Entities:** Detects city names, countries, and landmarks (`Paris`, `Tokyo`, `Hawaii`, `"New York"`, `"San Francisco"`).
    *   **Universal File Type Support (Beyond Photos):** Translates search intent for documents & OCR text (`type:document`, `tag:ocr`, invoices, receipts, contracts, resumes, papers), developer code files (`type:code`, `*.py`, `type:sql`, framework keywords), audio & music (`type:audio`, `genre:jazz,rock`, `artist:"Miles Davis"`, `length:>5m`), video footage (`type:video`, `resolution:4k`, `fps:>=60`, drone clips), compressed archives (`type:compressed`, `type:zip`, backups), installers (`type:installer`), and database dumps (`type:database`).
    *   **Seasons, Holidays & Events:** Translates seasonal ranges (e.g. `date:2023-06-2023-08` for Summer 2023), holidays (`Christmas date:2023`, `Halloween date:2023`, `"New Year" date:2024`), and milestone events (weddings, birthdays, graduations).
    *   **Universal LLM Compatibility & Output Sanitization:** Engineered a multi-stage output sanitization pipeline (`_sanitize_ai_search_query`) and structured zero-ambiguity system prompt that guarantees clean, deterministic WABS search queries whether powered by compact/edge LLMs (1B–3B parameter models e.g. Llama 3.2, Qwen 2.5, Phi-3, local Ollama) or frontier models (GPT-4o, Claude 3.5, Gemini). Automatically strips markdown code blocks, conversational filler, JSON envelopes, leading prefixes (`Query:`, `Search Query:`), and quotes.
    *   **Expanded Output Capacity:** Increased translation token capacity from 50 to 200 tokens to support rich, multi-criteria compound queries without truncation.
*   **Multi-Value Comma Separation for Search Filters:** Upgraded the search query parser (`_build_search_query`) to support comma-separated lists across key filter tokens (`person:Alice,Bob`, `rel:parent,child`, `object:car,beach`, `tag:blur,travel`, `type:audio,video`, `genre:rock,jazz`, `camera:sony,canon`), matching any or all targeted attributes seamlessly.
*   **Aspect Ratio Filter Engine (`aspect:`):** Added dedicated image orientation and aspect ratio filtering supporting `aspect:landscape` (wide/horizontal), `aspect:portrait` (tall/vertical), and `aspect:square` (1:1), with automatic dimension analysis from image and video metadata.
*   **Enhanced Resolution Filter Engine (`resolution:`):** Added smart resolution presets and dimensional comparison operators supporting `resolution:4k`, `resolution:2k`, `resolution:1080p`, `resolution:720p`, `resolution:sd`, and comparison queries (`resolution:>=1080p`, `resolution:>=4k`, `resolution:>1920x1080`).
*   **Dynamic Autocomplete for Aspect & Resolution (`/search/suggestions`):** Added live prefix suggestions for `aspect:` (`aspect:landscape`, `aspect:portrait`, `aspect:square`) and `resolution:` (`resolution:4k`, `resolution:1080p`, `resolution:720p`, `resolution:>=1080p`, `resolution:>=4k`) in the Topbar search suggestion drawer.
*   **"Photos Together" 1-Click Search:** Added an instant `👥 Together` action button on family links chips in Person detail view and on connection badges in the Relationship Tree. Clicking it automatically performs a multi-person search (`+person:"Alice" +person:"Bob"`) in Explorer to immediately show all photos where both people appear together.
*   **Kinship & Relationship Category Search Engine (`rel:` & `category:`):** Upgraded the search query tokenizer and query builder to support relationship (`rel:spouse`, `rel:sister`, `rel:child`, `rel:parent`) and social category filters (`category:family`, `category:friends`, `category:others`). Queries seamlessly join with `relationships.db` to match indexed photos of tagged individuals with full Boolean support (`+`, `-`, quotes).
*   **Expanded Search Help & Live Autocomplete Suggestions:** Updated Topbar search suggestions to autocomplete `rel:` and `category:` options, and overhauled the Topbar Search Help tooltip with clear examples for relationship queries and multi-person shared photo searches (`+person:"Alice" +person:"Bob"`).
*   **Quick 1-Click Relationship Dropdown on People Cards:** Added an interactive relationship badge and `+ Set Relation` button directly on Named People cards in the People grid. Users can rapidly assign primary categories and kinship/social presets (`Spouse`, `Parent`, `Child`, `Sibling`, `Grandparent`, `Aunt/Uncle`, `Cousin`, `In-law`, `Friends`, `Others`) in 1 click without opening photo galleries.
*   **Direct Tree Quick-Connect Popover:** Added a sleek `+ Link` action button to person nodes in the Relationship Tree view, allowing users to connect spouses, parents, children, and siblings directly within the visual hierarchy tree.
*   **Smart Sibling & Co-Parent Inheritance:** Engineered automatic kinship propagation in the relationships engine:
    *   Linking a parent to a child automatically establishes reciprocal `sibling` <-> `sibling` connections between the new child and their brothers/sisters.
    *   Linking a parent to a child automatically links the parent's spouse as a co-parent.
    *   Linking two spouses automatically connects existing children to both parents.
*   **Unified Relationship Tree Export Menu:** Centralized all export controls into an organized **"Export Tree"** dropdown menu in the Relationship Tree header with clear domain distinctions:
    *   👨‍👩‍👧‍👦 **Family Tree (Kinship & Relatives):** GEDCOM 5.5.1 (`.ged`) for genealogy tools (Gramps, Ancestry, FamilySearch) and printable PDF view of the family tree only.
    *   🤝 **Friends & Contacts (Social Circles):** Dedicated printable PDF view and filtered GEDCOM export for friends and social networks.
    *   🌐 **Complete Graph (All Categories):** Full GEDCOM export and comprehensive PDF tree view.
    *   Cleaned up relationship tree node cards by removing redundant per-branch buttons.
*   **Targeted GEDCOM Category Filtering:** Upgraded backend endpoint (`GET /people/export/gedcom?category=family|friends`) to filter `INDI` and `FAM` records strictly to the selected social domain while preserving the primary user identity ("Me") root anchor.
*   **Centralized Relationship Taxonomy Source of Truth:** Consolidated all relationship categories, subcategories, human-readable labels, and defaults (`RELATIONSHIP_SUBCATEGORIES`, `DEFAULT_SUBCATEGORIES`) directly in `RelationshipTree.jsx`. Removed duplicate string lists across the frontend, with `Person.jsx` dynamically rendering its subcategory options from the centralized definition.
*   **Collateral In-Law Kinship Suggestions:** Added autocomplete suggestions in Person view for *Maternal Aunt by Marriage (Mother's Brother's Wife)*, *Maternal Uncle by Marriage (Mother's Sister's Husband)*, *Paternal Aunt by Marriage (Father's Brother's Wife)*, and *Paternal Uncle by Marriage (Father's Sister's Husband)* under `Family` ➔ `Aunt / Uncle`.
*   **Database Indexes & Memory Temp Store:** Configured SQLite connection pool with `PRAGMA temp_store=MEMORY` and added multiple expression and composite indexes (`idx_files_date`, `idx_files_size_cast`, `idx_files_category_date`, etc.) to optimize date, size, and category-filtered queries, resolving slow loading times when clicking on Photos card or scrolling through large lists and preventing "database or disk is full" temp space errors.
*   **Multi-Layer Defense-in-Depth Security Architecture:** Implemented comprehensive security across the network, browser, authentication, and data layers:
    *   **Localhost Network Isolation by Default (`127.0.0.1`):** Server now binds strictly to `127.0.0.1` by default to block unauthorized LAN/Wi-Fi devices from accessing the archive. An explicit toggle in Settings (`allow_lan_access`) allows remote phone/tablet access only when specifically requested.
    *   **CORS Lockdown & Regex Origin Filtering:** Eliminated wildcard `allow_origins=["*"]` from API middleware, restricting cross-origin requests via strict localhost regex patterns (`^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$`) to prevent background web tab exfiltration.
    *   **Master PIN Authentication (Digits Only, 4-12 digits):** Implemented user PIN protection strictly restricted to numbers (`0-9`, 4-12 digits) hashed via `PBKDF2-HMAC-SHA256` (100,000 iterations + 16-byte random salt). Non-numeric input is sanitized automatically on both frontend and backend.
    *   **Cryptographically Secure Session Tokens & Strict Lock Revocation:** Issues 32-byte URL-safe session tokens (`X-Session-Token`) on successful PIN authentication. When locking the app manually or automatically via the inactivity timer, session tokens are completely revoked on the backend and wiped from browser storage (`localStorage` & `sessionStorage`), ensuring that page refreshes, reopening from the System Tray, or connecting from other devices strictly require re-entering the PIN.
    *   **Protected Background Task Execution:** Background indexing workers (file scanning, face detection, object tagging, OCR text extraction) run safely in the background on the local machine when the app is locked, while preventing unauthenticated users on the network or physical device from inspecting or controlling data until unlocked.
    *   **Anti-Brute Force Rate Limiting:** Enforces a 5-minute cooldown lockout after 5 consecutive failed PIN attempts with live seconds countdown.
    *   **Responsive Lock Screen Overlay (`LockScreen.jsx`):** Sleek PIN entry modal overlay featuring numeric-only inputs, touch-friendly on-screen numpad, lockout countdown, and setup mode.
    *   **Inactivity Auto-Lock:** Monitors user activity across mouse, keyboard, touch, and scroll events to automatically lock the session after a configurable idle period (5m, 15m, 30m, 1h, Never).
    *   **One-Click Instant Lock:** Integrated a lock icon button in the Topbar for instantaneous manual session locking.
    *   **Dedicated "Security & Privacy" Settings Tab:** New settings panel to configure/change/disable Master PIN, toggle LAN access, adjust auto-lock duration, toggle AI PII redaction, and clear caches.
    *   **AI Privacy & PII Redaction:** Automated regular-expression filter that masks phone numbers, emails, and IP addresses before sending prompts or file metadata to external AI providers.
    *   **Thumbnail Cache Management:** Added options to clear the thumbnail cache on demand or automatically purge preview caches upon application exit.
    *   **Data at Rest (DAR) Guidance & Notice:** Added clear user notices in the UI and documentation clarifying that SQLite databases (`archive.db`, `ai_metadata.db`, `relationships.db`) and preview thumbnails are unencrypted on disk to prioritize performance, advising users to utilize OS-level full disk encryption (BitLocker / LUKS / FileVault) for physical disk protection.
    *   **Structured Security Operation Logging:** Comprehensive logging across all security events (`wabs.security` / `wabs.auth`), tracking authentications, lockouts, session lifecycle, and cache operations in `wabs.log`.
    *   **Automated Security Test Suite (`tests/test_security.py`):** Added a dedicated unit and integration test suite integrated into `tests/run_all_tests.py` covering PBKDF2 hashing, session lifecycle, rate limiting, PII redaction, and full API authorization flows.
*   **Sidecar Social Taxonomy & Relationships Database (`relationships.db`):** Implemented a dedicated SQLite sidecar database to isolate user-curated social classifications from core physical file indexing (`archive.db`) and disposable AI face clusters (`ai_metadata.db`).
*   **Inter-Person Relationships Graph (`person_connections`):** Added inter-person connections schema and reciprocal edge synchronization (`spouse` <-> `spouse`, `partner` <-> `partner`, `parent` <-> `child`, `sibling` <-> `sibling`). Users can connect spouses, parents, children, and siblings directly from any profile view.
*   **GEDCOM 5.5.1 Genealogy Export:** Added full export compatibility with standard genealogy software (Gramps, Ancestry, FamilySearch). Supports exporting the complete tree as well as subtrees rooted at any selected family branch with individuals (`INDI`), family units (`FAM`), gender inference, and WABS lineage metadata.
*   **PDF & Printable Tree View:** Added instant export to PDF and clean print formatting for the complete relationship graph and family sub-branches.
*   **Rescan & Wipe Protection (Stable Person Registry):** Engineered a persistent `persons` registry with soft-link references (`ai_person_id`). If the face metadata database (`ai_metadata.db`) is wiped, cleared, or re-evaluated, relationship metadata remains 100% intact and automatically soft-relinks when profiles are re-scanned or renamed.
*   **"Who Am I?" User Identity & Settings Notice:** Added user identity configuration in Settings (General tab) allowing users to designate their own profile (`me_name`) to anchor relative kinship branches in the relationship tree, with a concise hover-informative notice regarding identity re-anchoring.
*   **Dedicated "Me" Identity UI Badge:** When viewing the primary user's profile ("Me") in Person view, the uncategorized relationship dropdown is replaced with a clear, designated Primary User Identity badge.
*   **Person Gallery Scroll & Photo Cache Retention:** Implemented client-side memory caching (`personGalleryCache`) and scroll restoration (`savePersonScroll`) so that navigating back and forth between People and a Person's photos preserves all loaded pages and exact scroll position.
*   **Category-Aware View Context & Navigation Caching:** Implemented category-specific view caching using keys formatted as `${page}_${view}_${filterCategory}` (e.g. `explorer_flat_photo`), allowing each category tab (Photos, Videos, Audios, Documents, etc.) to cache and recover its own loaded files list, pagination offsets, and scroll heights. Unified all loader logic into a single centralized cache manager `useEffect` hook, removing duplicate file loads on folder, category, and navigation transitions.
*   **Interactive Multi-Column Relationship Tree View (`RelationshipTree.jsx`):** Developed a responsive, multi-column card hierarchy for social and family structures anchored to your profile ("Me"). Users can browse Family, Friends, and Others side-by-side with avatar thumbnails, live photo counts, branch badge counters, relative badges, subtree exports, instant tree search filtering, and one-click "Expand" / "Collapse" controls.
*   **Dedicated Tabbed Navigation for People & Tree:** Converted the People view into clean top-level tabs:
    *   **People Tab (Default):** Complete profile grid with Category Filters (`All`, `Family`, `Friends`, `Others`, `Uncategorized`), "Sort by" controls, Named People search/cards, and Unknown People clustering controls.
    *   **Tree View Tab:** Dedicated view displaying exclusively the Multi-Column Relationship Hierarchy Tree, keeping the interface uncluttered and context-focused.
*   **Explicit Relationship Confirmation (✓ Save / ✕ Cancel):** Enhanced relationship editing in the Person detail view (`Person.jsx`) with buffered local state and explicit Checkmark (✓) and Cancel (✕) buttons (with <kbd>Enter</kbd> and <kbd>Escape</kbd> keyboard shortcuts), preventing unintended database mutations during multi-step dropdown selection.
*   **Extended Kinship Support ("In-laws"):** Added dedicated "In-law" classification (`In-law (Father / Mother / Brother / Sister-in-law)`) under Family and integrated the corresponding branch into the Relationship Hierarchy Tree.
*   **Self-Healing Configuration Schema:** Upgraded `load_config()` in `config.py` to auto-detect missing configuration keys on startup and non-destructively write default values to `config.yaml`, while `save_config()` safely merges partial frontend updates without dropping untouched fields.
*   **Inline Relationship Categorization Bar:** Integrated an inline relationship editor directly below the header in the Person detail view (`Person.jsx`), enabling one-click assignment of primary category (`Family`, `Friends`, `Others`), kinship/social subcategory, custom free-form labels, and family links.
*   **People Page Category Filter Bar:** Added dynamic filter pills (`All`, `Family`, `Friends`, `Others`, `Uncategorized`) with real-time profile counters on the People page. Active filter preferences are automatically persisted in `config.yaml`.
*   **Kinship-Enriched People Search:** Expanded the client-side search matcher on the People page to query name, category, subcategory, and custom relation labels with zero additional server requests.
*   **Card Badges & Me Highlights:** Enriched person profile cards with dedicated category/relationship badges and highlighted the user's own card with a blue border and "Me" badge.
*   **Comprehensive Search Engine & Query Builder Overhaul (`search.py`):**
    * Refactored `_build_search_query` with a tokenization parser supporting all documented search patterns:
      * **Compound Size & Range Filters:** Supports compound comparisons (`size:>100MB, <5GB`, `size:>100MB <5GB`), ranges (`size:100MB-5GB`), single comparisons (`size:>100MB`, `size:<5GB`, `size:>=10MB`, `size:<=2GB`, `size:=500KB`), and all standard byte units and shorthand units (`B`, `KB`, `MB`, `GB`, `TB`, `PB`, `k`, `m`, `g`, `t`, `p`).
      * **Duration & Media Length Filters:** Supports compound comparisons (`length:>5m, <1h`), ranges (`length:5m-1h`), timestamps (`length:>01:30`, `length:>01:30:00`), and unit abbreviations (`s`, `sec`, `m`, `min`, `h`, `hr`, `hours`).
      * **Advanced Date & Year Range Filters:** Supports multi-date expressions (`date:2020-2022, 2023-10-25`), year ranges (`2020-2022`), full/partial date comparisons (`>2020`, `<2024`, `>=2023-01-01`), exact dates (`YYYY-MM-DD`, `MM-DD-YYYY`, `DD-MM-YYYY`), and specific years/months (`2023`, `2023-10`).
      * **Category & Extension Filters (`type:`):** Full support for standard categories (`type:audio`, `type:video`, `type:photo`, `type:document`, etc.), multi-type lists (`type:audio,video`), and file extensions (`type:mp3`, `type:.mp3`, `type:pdf`).
      * **Case-Insensitive Tag, Object, and Person Matching:** Normalized tag and person queries with `func.lower`, supporting namespaced (`object:car`, `person:John Doe`), plain (`car`, `John Doe`), quoted (`person:"john doe"`), and partial name searches (`person:john`).
      * **Wildcard Matching:** Full wildcard support (`*.mp3`, `*vacation*`, `img_*`) mapping `*` to `%` and `?` to `_` in filename and path lookups.
      * **Boolean Operators & Search Semantics:** Correctly joins space-separated terms with `OR` (Match Any), enforces `+` (Match All / Require) across all prefixes and terms, and supports `-` (Exclude / NOT) across all attributes, sizes, types, and wildcards.
*   **Dynamic Prefix Suggestions (`/search/suggestions`):** Upgraded search suggestions to provide live autocomplete pills for `object:`, `person:`, `tag:`, and `type:` prefixes directly within the Topbar suggestion drawer, complementing keyword autocompletion and did-you-mean spell checks.
*   **Instant Search on Enter:** Added instant search execution when pressing `Enter` in the Topbar search input, bypassing the 600ms debounce timer for immediate UI updates.
*   **Data Management Integration:**
    * Added standalone **Export / Import JSON** for Relationships & People Categories in Settings ➔ Data Management.
    * Added standalone **Export GEDCOM (.ged)** and **Export PDF** from Relationship Tree.
    * Updated **Combined WABS Backup** to include relationship data.
    * Updated **Full Database Backup** to archive `relationships.db` alongside `archive.db`, `ai_metadata.db`, and `config.yaml`.
    * Updated **Database Cleanup & Optimization** to purge dead relationship references and vacuum `relationships.db`.

### 🐞 Bug Fixes & Refinements
*   **Dependent Category-to-Subcategory State Synchronization:** Fixed a state desynchronization bug in `Person.jsx` where changing the primary relationship category (e.g., from `Family` to `Friends`) retained an incompatible subcategory in React state (e.g. `"Spouse"`), causing cards to save and display mismatched labels (such as `"Spouse • Sister"`). WABS now dynamically validates and resets the subcategory to that category's proper default on change.
*   **Locate File in Flat/Tree Views (Scroll-to-Highlight):** Fixed scroll positioning when locating files by modifying the `suppressNextAutoLoad` flow to prevent concurrent React transitions from prematurely wiping the loaded files list. Added physical directory file offsets calculation to support scrolling to located files inside large folders in Tree View.
*   **SQLite disk full crash & Infinite Scroll loop:** Ignored programmatic scroll adjustments during view state transitions via an `isRestoringScroll` flag and cleared cached scroll heights on cache invalidation, preventing infinite recursive `loadMore` cascades and associated `sqlite3.OperationalError` database crashes. Fixed falsy-value checks on `ctx.scrollTop` values to correctly force-restore 0 scroll positions to the top, preventing the scrollbar from remaining stuck at the bottom. Also resolved a JavaScript Temporal Dead Zone `ReferenceError` on boot by re-ordering ref declarations, fixed a missing `useState` import on the `People.jsx` page, and implemented a unified `isLoadingRef` request lock and a 1000ms request cooldown throttle (`lastLoadTimeRef`) on `loadMore`/`loadPrevious` to prevent scroll-triggered loops and rapid-fire cascades during fast-scrolling on initial mounts, transitions, or collapsed image rendering.
*   **Tree Subgroup Collision Fix:** Resolved a critical UI crash (`TypeError: familySubgroups.children.push is not a function`) when assigning kinship to Children/Sons by renaming the internal subgroup mapping key to `kids` to avoid collision with standard node `.children` arrays.
*   **Sidecar Database Parent Directory Auto-Creation:** Fixed startup failure (`unable to open database file`) when starting WABS with a clean or custom database directory by ensuring parent directories are automatically created before initializing `relationships.db` and `ai_metadata.db`.
*   **Python Inner Import Shadowing Fix:** Removed shadowing inner `import sqlite3` inside `_process_unified_scanners` in `indexer.py` that caused `cannot access local variable 'sqlite3'` runtime exceptions.
*   **Frontend Comma Stripping Fix:** Removed destructive `.replace(/,/g, ' ')` in `useExplorer.jsx` and `App.jsx` that stripped commas from compound search queries (`size:>100MB, <5GB`, `date:2020-2022, 2023-10-25`) and quoted search strings.
*   **Search Pagination Reference Error Fix:** Fixed an undefined `safeQuery` variable in `loadPrevious` in `useExplorer.jsx`, eliminating crashes and restoring smooth reverse-scrolling on search result views.
*   **Automated Search Pattern Test Suite:** Added a dedicated 22-test automated test suite (`tests/test_search_patterns.py`) integrated into the master test runner (`run_all_tests.py`) to prevent search pattern regressions.

## v1.1.0

### 🚀 Major New Features & Enhancements
*   **Settings Tab Layout Optimization:** Reordered the Settings tabs to make the "Backups" (locations) tab the second option and the "Data Management" tab the last option, improving the default settings setup and configuration flow.
*   **Settings Backup Verification Nudge:** Integrated an intelligent toast notification warning when saving settings without any configured backup locations. Tapping the "Configure" button in the toast redirects the user directly to the Backups tab.
*   **Hierarchical Virtual Folders:** Implemented a full parent-child folder tree navigation system. Users can create, rename, and nest subfolders indefinitely with multi-level breadcrumbs navigation.
*   **Direct Disk Export (Native Folder Selector):** Added an option to export any virtual folder (along with its subfolders and files recursively) to another drive. Integrated with a native OS-level folder selector (Windows/Linux) to select destination paths directly.
*   **Dynamic Queries & Hybrid Folders:** Integrated dynamic rules/query filters for both root folders and subfolders. Files matching the query rules are combined with manually added files in the folder view.
*   **Recursive File Counts:** Corrected the file counter for virtual folders to calculate and display the recursive sum of files in the current folder and all of its subdirectories.
*   **Data Portability (Virtual Folder Import/Export):** Extended Data Management in Settings to support importing/exporting virtual folder structures. Added a "Combined Backup" option to export all WABS metadata (Known People, Object/Custom Tags, and Virtual Folders) together in one step. Includes color and icon configuration details.
*   **Virtual Folder Color & Icon Customization:** Integrated styling controls into the folder Create/Edit modals in Virtual Folder and Explorer layouts. Users can choose from a curated palette of 10 modern colors and 11 descriptive icons. Configurations are stored inside the SQLite database as serialized metadata.
*   **Audio Album Art Extraction:** Integrated cover/album art extraction from audio files using the `mutagen` metadata library. Supported formats include MP3 (ID3 tags via `APIC` frames), MP4/M4A (`covr` tag), FLAC and OGG (via the `pictures` attribute or base64-encoded `metadata_block_picture` in Vorbis comments), and WMA/ASF (`WM/Picture` tags).
*   **Audio Thumbnail Caching:** Automatically scales and saves extracted cover art as a 400x400 JPEG inside the `audio` subdirectory of WABS's cache folder (i.e. `.wabs_cache/audio`), keeping the cache structured.
*   **Dynamic Audio Preview Serving:** Updated the `/preview/{item_id}` endpoint to serve the cached JPEG cover art when requested, falling back to a text SVG if no cover art exists.
*   **Indigo Audio Fallback Placeholders:** Added custom indigo-themed placeholders (`#f5f3ff` for light theme, `#1e1b4b` for dark theme) in the frontend Explorer layout to represent audio files without cover art, rather than using a generic offline placeholder.
*   **Virtual Folder Search Scope Limiting:** Restricted search queries initiated from within a Virtual Folder view to only match files within that Virtual Folder. General searches performed outside Virtual Folders continue to query all indexed workspace files.
*   **Unified Virtual Folder Filter Behavior:** Integrated Virtual Folder selections inside the Explorer Filter dropdown to behave identically to standard categories (e.g., Photos, Videos). Selecting a Virtual Folder filters the current Explorer grid list in-place rather than jumping layout view context.
*   **Multi-Option Locate Action:** Upgraded the static file locator into an interactive dropdown selector. Users can now choose to locate a selected file in the physical Folder Tree view, Flat List view, or its associated containing Virtual Folders (automatically managing page transitions, view toggles, folder expansion, and scroll highlighting).
*   **Recursive Virtual Folder Flat View:** Integrated recursive file loading inside Virtual Folders when in Flat View, showing files across the selected folder and all its nested subfolders, while hiding the subfolder card grid for a cleaner layout.
*   **Sidebar Decoupled Folder Tree:** Decoupled the physical Folder Tree lister from the paginated files list, querying directories from a dedicated endpoint to keep the sidebar stable while scrolling or paging.
*   **Subfolder Grid Selection Checkboxes:** Integrated selection checkbox controls into both physical subdirectory cards and virtual folder cards in the Tree View lister. This allows users to select one or more subfolders directly in the right pane.
*   **Recursive Folder Actions Support:** Extended the backend `/delete-files`, `/copy-files`, and `/move-files` endpoints to process directory paths recursively on disk and the database, making actions like move, copy, and delete instantly compatible with selected subfolders.
*   **Persistent Layout & View Settings:** Configured active view selection (`Flat` or `Tree` view) and layout divider widths (sidebar, timeline, details panel) to be persisted in the backend configuration file (`config.yaml`), ensuring they are fully restored across restarts and clients.
*   **Virtual Folder Batch Operations:** Upgraded virtual folder endpoints to support path-based files association, resolving recursive files from physical subdirectories and dynamic rules to allow adding/removing directories into/from virtual folders.
*   **Recursive Directory & Virtual Folder Operations:** Extended the backend `/delete-files`, `/copy-files`, and `/move-files` endpoints to support directory paths and virtual folder paths (`virtual_folder:{id}`) recursively. Operations now copy (`shutil.copytree`), move (`shutil.move`), or delete (`shutil.rmtree`) directories and virtual folder files recursively on disk while automatically updating or removing the corresponding file indices in the SQLite database.

### 🐞 Bug Fixes & Refinements
*   **Root-Only Dashboard Count:** Fixed the Dashboard virtual folder statistics tile to only count root-level folders, resolving incorrect counts when subfolders were present.
*   **Explorer Auto-Reload & Navigation Reset:** Fixed a regression where files did not reload automatically when navigating to virtual folders from the filter dropdown. Added automatic reset of active category filter back to `'all'` when navigating inside a virtual folder to prevent audio files from being hidden.
*   **Smart Back-Navigation:** Deleting a subfolder now gracefully navigates the user back to the parent folder in the hierarchy, or redirects to the main Virtual Folders tile if the last folder is deleted.
*   **Tree Selection UX Optimization:** Refactored the `AddToFolder` modal node selection logic. Clicking anywhere on a folder row now toggles expand/collapse state, while selecting a folder is done via a dedicated "Select" button to prevent accidental selections of parent folders.
*   **Folder State Integrity:** Preserved parent hierarchy and configuration during virtual folder updates and renames, preventing nested subfolders from accidentally converting to root folders.
*   **Missing Category Filters Alignment:** Added the missing `"untagged"` category query block to the virtual folder files endpoint, ensuring correct results when filtering untagged media.
*   **Consolidated Shared Constants:** Centralized duplicate variables and configuration lists (such as standard categories, search query prefixes, searchable document categories, and extension type mappings) into a single constants module, removing code duplication across backend routes, indexing, and search files.
*   **Search Results State Preservation:** Fixed a bug where browser load effects triggered on search page transitions and overrode query results with standard directory listings, restoring full search syntax (e.g. `object:car` or `person:John`) and keywords search.
*   **Concept of "Computer" Removal:** Removed the redundant `"Computer"` fallback root node and any parent drive letter entries from the Folder Tree sidebar. Physical navigation and folders list now strictly display the collection of your configured backup locations.
*   **Physical Navigation Boundaries:** Restructured the physical directory "Up" navigation to bypass intermediate unmapped parent drive paths (`M:`) and navigate straight back to the Backups collection root.
*   **Real-time View Context and Scroll Preservation:** Fixed view-toggling scroll resets by implementing real-time scroll caching and layout restoration. Toggling between Flat View and Tree View inside both Explorer and Virtual Folder layouts now fully preserves files, pagination offsets, and scroll positions exactly where you left off.
*   **Path Trailing Slashes Normalization:** Standardized path comparisons to strip trailing slashes during backup mappings and lister matches, resolving duplicate node glitches caused by settings slash formatting.
*   **Graceful Shutdown & Background Hang Fix:** Resolved a series of shutdown reliability issues on Windows: (1) Fixed a race condition where the system tray icon failed to stop — thread-safe icon stop calls via locks and redundant ASGI-thread shutdown hooks were eliminated on Windows. (2) Fixed uvicorn hanging indefinitely on `INFO: Shutting down` when the browser had open HTTP keep-alive connections — added a `force_exit` fallback that kicks in after 5 seconds if connections do not drain on their own. (3) Added `os._exit(0)` at process end to immediately terminate lingering background threads (e.g., ONNX Runtime or library-level finalizer deadlocks) that would otherwise keep the Python process running.
*   **System Tray Shutdown Test Integration:** Created a portable test script (`tests/test_shutdown.py`) to launch, query, and verify the clean shutdown of the WABS server and system tray icon.
*   **Flat List & Virtual Folder Locate Fix:** Resolved a bug where locating a file in Flat List (Flat View) or Virtual Folders failed if the file fell outside the first loaded chunk of 50 files. Added a backend `/files/{file_id}/offset` API endpoint to compute the file's exact 0-indexed position under the active sorting/filtering rules. The frontend now dynamically pre-loads the correct paginated files chunk around the target offset, enabling seamless scroll-to-highlight.
*   **Locate in Explorer for Person Photos:** Resolved the undefined onClick handler error for the "Locate in Explorer" action in the Person photos view, wiring it to highlight the photo in the main Explorer timeline.
*   **Locate File Fixes (Scroll-to-Highlight):** Fixed a bug where locating a file in Flat View or Tree View from other views did not scroll or highlight the file, especially when it was lazy loaded far down the list. We resolved this by forwarding the pending locate ref to `<DateGroup>` to bypass the IntersectionObserver and mount the target card immediately. Furthermore, we used `requestAnimationFrame` polling to ensure the browser has finished layout rendering before triggering the scroll, and updated the cached `scrollTop` value to prevent React scroll resets.
*   **Virtual Folder "Move to Folder" & Caching Fixes:** Added a "Move to Folder" button inside the Selection Bar when viewing virtual folders, enabling users to move selected items in one step. Addressed a caching bug by implementing a `invalidateViewCache` helper that invalidates stale view cache entries after add, remove, copy, move, or delete operations. Additionally, updated the removal logic to delete associations from the source folder recursively, ensuring files are cleanly removed from the parent virtual folder and any of its descendant subfolders when moving or removing files from a flat/recursive view. Crucially, tag/object addition/removal and person profile changes now trigger this cache invalidation and reload virtual folders, ensuring any dynamic rules relying on these tags automatically update their file list and sidebar counts. Also, when files are removed or moved from a dynamic (rule-based) virtual folder, WABS automatically converts it to a manual folder and copies all current matched files as manual associations before removing the target files, ensuring the user's intent is preserved without losing the rest of the folder's files. The `loadVirtualFolders` action has been updated to immediately synchronize and refresh the active `currentVirtualFolder` metadata state, ensuring folder UI state indicators (like the "Rules ✓" checkmark) update instantly when a folder is converted to manual.
*   **POST-Based Association Deletion:** Registered a `POST` route alias `/virtual-folders/{folder_id}/files/delete` on the backend to safely receive file deletion requests, bypassing issues where HTTP clients or proxy servers drop request body payloads for standard `DELETE` requests.
*   **Offline Cover Photo Preview Fixes:** Corrected a bug in the untagging route (`remove_person_photo`) where the cached cover thumbnail (`person_{person_id}.jpg`) was deleted unconditionally. We now preserve the cached crop if the untagged photo was not the cover photo itself, preventing broken/disappeared preview thumbnails when the original files reside on detached or offline external storage.
*   **Offline Thumbnail Suggestion Nudge:** Added a friendly, clear warning in the `auto_suggest_thumbnail` endpoint when all source files are offline or detached, replacing the generic suggestion failure alert with descriptive details.
*   **Virtual Folder Topbar Toggle Fix:** Corrected the topbar view toggle action to query the active `virtualFolderViewType` when in a Virtual Folder context, correctly showing "Toggle Tree View" (instead of "Toggle Timeline") when the folder tree view layout is active.

## v1.0.1

### ⚡ Performance & Caching
*   **Compiled ImageNet Mapping:** Converted the ImageNet class mapping from an external JSON file to a compiled Python static dictionary (`imagenet_mapping_data.py`). This allows WABS to load the mapping instantly via Python bytecode compilation (`.pyc`), completely bypassing disk reading and JSON string parsing at runtime, and avoiding spec file payload bloating.
*   **On-Demand Lazy Loading & Memory Release:** Implemented lazy loading of the ImageNet mapping so it is imported dynamically only when an active object scan is running. Integrated it with WABS's idle memory release routine (`unload_heavy_modules`), which clears the cache and removes the compiled module from Python's internal import registry (`sys.modules`) when WABS goes idle.
*   **Idle ONNX Model Unloading:** Optimized WABS's memory footprint by dynamically unloading heavy machine learning models (ONNX models for Face Detection, Face Recognition, Object Classification, and OCR) and removing `onnxruntime` and `rapidocr_onnxruntime` from python's modules cache once the application becomes idle (respecting the idle timeout configured in Settings).
*   **On-Demand Model Loading:** Guaranteed that no machine learning models or libraries are loaded on application startup. Models are initialized purely on-demand when a scan starts or when face identification is requested.
*   **Memory Reclamation:** Leveraged python's garbage collector (`gc.collect()`) and dynamic C++ heap trimming (`malloc_trim`) to force immediate reclamation of heap allocations and C++ engine memory buffers back to the operating system.
*   **Extended Memory Management Options:** Added **15 minutes** and **2 hours** options to the Memory Management idle timeout dropdown list in Settings.
*   **Removed OpenCL DNN Backend Fallback:** Disabled the OpenCV OpenCL DNN target (`DNN_TARGET_OPENCL`) for face and object detection, defaulting directly to the CPU backend (with CUDA remaining for NVIDIA GPUs). This resolves massive scanning freezes and CPU/GPU lockups (where processing a single image could take up to 24+ seconds) caused by dynamic OpenCL convolution kernel compilations on images of varying sizes.
*   **Face Scanner Size Filtering:** Automatically filters out and skips face detection scans for small images and icons (dimensions `< 100px` in width or height) to prevent false-positive face detections and speed up scan times.
*   **Single-Decode Scanner Optimization:** Optimized the unified scanner loop to ensure each file is opened and decoded exactly once per scan step, saving redundant disk I/O and CPU cycles across Face, Object, and OCR pipelines.
*   **Redundant Face Detection Avoidance:** Guaranteed that face detection is never run twice on the same image. The object classifier queries the database for existing face records created by the preceding face detection step, skipping the fallback 3ms YuNet check entirely if faces are already present.
*   **100% In-Memory Face Exemplar Curation:** Replaced the slow disk-bound/YuNet-based face exemplar curation with a fast (under 5ms) in-memory NumPy curation. This selects the centroid, 8 typical representations, 6 diverse boundary faces, and 10 timeline-distributed chronological faces entirely in memory, completely eliminating redundant disk reads and YuNet model calls.
*   **Scanner Preloading & Bulk Curation:** Updated the scanner startup preloading, `/people/cluster-unknowns` and `/people/reclassify` endpoints to fetch file modified dates in bulk and use the in-memory curation, ensuring the background scanners and clustering tools match faces with high accuracy without OOM or startup lag.
*   **Face Scanner $O(N)$ Matrix Optimization:** Optimized the scanning loop and the `/people/reclassify` route to maintain a running 2D NumPy array (`new_embs_matrix`) for in-memory matching instead of calling `np.vstack` or Python loops on every face check. This avoids quadratic data-copying overhead, keeping matching constant-time and fast.
*   **Unified Face Matching Helper:** Unified the face similarity calculation logic across background scanning and reclassifications into a single `find_best_face_match` helper using 2D NumPy array matrix multiplication.
*   **Multi-Person Conflict Resolution:** Implemented a two-pass matching candidate sorting step in the scanner loop and the `/people/reclassify` route. It processes the strongest matches first and prevents mapping two different faces in the same photo to the same person ID.
*   **Active Cache Drift Mitigation:** Gated active template cache additions (`new_embs_matrix`) during background scans and reclassifications behind a high-confidence threshold of `0.70` (while mapping borderline matches `> 0.55` to the DB), completely eliminating cascading false-matches (cluster drift).
*   **Centroid-Based Cover Photo Default:** Modified `/people/{person_id}/thumbnail` to use the NumPy-computed centroid face (the most representative face of the cluster) as the default cover photo fallback, rather than the most recently added face.
*   **Aesthetic Crop Similarity Guard:** Increased the crop similarity threshold to `0.65` (up from `0.40`) to prevent cropping a friend's face in group photos if the target face detection fails.
*   **Auto-Purge Stale Thumbnail Cache:** Automatically purges the face thumbnail folder on disk when a new/empty database scanner starts, preventing new profiles from displaying stale images from prior runs.

### 🐞 Bug Fixes & Refinements
*   **Name-Based Favorite & Hidden Profile Persistence:** Saved named profiles by name (and unknown profiles by ID) in user preferences (`pinned_people` and `hidden_people`). This prevents favorites and hidden profiles from being lost, reset, or mismapped to incorrect profiles when database IDs shift after re-indexing or Known/Names people imports.
*   **Face-Aware Animal Thresholding:** Elevated the classification threshold for animal/pet categories (such as `animal`, `mammal`, `pet`, `dog`, `cat`) to a strict minimum of `0.45` if a human face is present in the image, preventing false-positive animal tags on photos of people.
*   **Scanner Pipeline Ordering Swap:** Adjusted the scanner execution order to run face detection before object classification. This allows the object classifier to instantly read existing face records from the database or fall back to a fast 3ms YuNet check if face scanning is disabled.
*   **Aggregated Tag Suppression:** Suppressed broad, noisy generic category tags (such as `clothing`, `apparel`, `household`, `object`) from high-level mapping outputs to keep detected metadata clean and relevant.
*   **Improved Object Tag Detection Accuracy:** Implemented **probability aggregation** in the object scanning process. Sums the probabilities of all ImageNet subclasses belonging to the same high-level category (e.g., summing 118 dog breeds to `dog`, `animal`, and `pet`), resolving split-probability softmax issues. Added a **1.5% subclass noise floor threshold** to prevent low-probability uniform noise from aggregating into false-positive broad categories (like `animal` or `household`) on text/document screenshots and noise images.
*   **Hybrid Specific & High-Level Tagging:** Retains high-confidence specific tags (e.g., `object:golden_retriever`) alongside broad high-level tags when individual subclass confidence exceeds the user's sensitivity threshold.
*   **Transparent Image Compositing:** Implemented transparent-to-white background compositing for PNG, GIF, and WebP files inside the initial PIL metadata pass. This stops transparent icons from being misclassified by the object scanner (e.g., preventing a transparent hexagon from being identified as a "spatula").
*   **Aspect Ratio-Preserving Letterboxing:** Integrated aspect-ratio-preserving letterboxing resize onto a white 224x224 canvas for the object classifier, significantly improving classification accuracy for non-square images.
*   **Fixed UnboundLocalError for OCR:** Fixed a bug where `ocr_enabled` was referenced before assignment when standard OpenCV decoding was bypassed by transparent image loading.
*   **Verbose Log Timestamps & Timings:** Added datetime timestamps to verbose console log outputs and included log entries to track and print decode performance timings for scanners.
*   **Cosmetic Shutdown Traceback Suppression:** Added custom logging filters that silence verbose tracebacks caused by standard `KeyboardInterrupt` and `asyncio.CancelledError` exceptions in Uvicorn loggers during terminal Ctrl-C shutdown.
*   **Pystray Dock Error Traceback Silence:** Suppressed the cosmetic `AssertionError: Failed to dock icon` traceback originating from `pystray`'s X11/Xorg backend on Linux/Ubuntu when the tray window is destroyed.
*   **Safe System Tray Icon Stop:** Handled `KeyboardInterrupt` exceptions silently in `stop_tray_icon()` during X11/Xlib display flushes on exit, preventing unhandled PyInstaller script crashes.
*   **Automatic Tray Icon Exit on Server Shutdown:** Connected WABS's `@app.on_event("shutdown")` hook to stop the system tray icon automatically, resolving terminal hangs on Linux/Ubuntu when shutting down via the Web UI `/shutdown` endpoint.
*   **Graceful Shutdown Cleanup:** Added file handle unloading during WABS shutdown, resolving Windows/Linux file lock issues that previously blocked Python from cleaning up temporary files.
*   **Startup Version Print:** Exposes the running WABS version immediately on boot with robust directory fallback imports to support both production and various development environments.
*   **Person Cover Fallback for Missing Models:** Prevented person profiles from displaying blank covers if face models are missing or deleted by falling back to the uncropped source photo.

### 🛡️ Safety & System Cleanliness
*   **PyInstaller Temp Folder Locking (Windows):** Locks static assets (ONNX models, dictionary configs, frontend HTML/JS/CSS assets) in the temporary PyInstaller extraction folder (`_MEIPASS`) by keeping read-only file descriptors open during process execution. This prevents Windows from allowing manual deletions or system disk cleanups while the application is running, while still allowing clean folder deletion on process exit.
*   **Dynamic Model Health Checks:** Checks model file existence during indexer status polls and returns a `system_warning` if files are missing, which is displayed as a prominent health warning banner at the top of the React UI.
*   **Scan Model Validations:** Checks for required AI models before starting face, object, or document scans, returning a clean HTTP 400 error advising a restart if files are missing instead of failing silently in background threads.
*   **Atomic Directory Renaming on Exit:** Replaced the legacy `temp_dirs.txt` cache registry and the runtime `wabs_active_lock.txt` lock file with an atomic folder-renaming strategy on shutdown (renaming `_MEIxxxxx` to `_MEIxxxxx_to_delete` first to check if DLLs are locked before deleting, ensuring folders are either 100% cleanly deleted or left 100% intact for subsequent startup cleanup).
*   **Orphaned DLL-Only Temp Folder Purger:** Added an automatic cleanup scanner on startup (`is_leftover_dll_only_folder`) that scans for and purges legacy `_MEI` temp folders containing only standard C-runtime DLLs (`msvcp140.dll`, etc.), freeing up disk space safely while strictly preserving other applications' temp folders.
*   **Strict Temp Directory Deletion Constraints:** Reinforced folder deletion paths (`is_safe_mei_folder`) to guarantee they are strictly subdirectories of the system's root temp directory, protecting the system from accidental file deletions.

### 🧹 Database Cleanup & Optimization
*   **Orphaned AI Records Purging:** Enhanced the database cleanup routine to delete orphaned records in `faces`, `processed_files`, and `processed_objects` tables inside the sidecar `ai_metadata.db` that reference deleted/missing files.
*   **Orphaned Text Search Cleanup:** Clears orphaned records from `processed_text` and `file_text_fts` text-indexing tables whose `file_id`s do not exist in the main database.
*   **Empty Profiles & Cached Thumbnails Deletion:** Automatically deletes empty people profiles (profiles with zero remaining face detections) and removes their cached face thumbnail file (`person_{person_id}.jpg`) from the disk.
*   **Broken Cover Photos Reset:** Resets `thumbnail_file_id` to `NULL` for people profiles whose selected cover photo refers to a deleted file, allowing them to fall back to a valid cover face.
*   **SQLite Database Vacuuming:** Runs SQLite `VACUUM` on both the main database (`archive.db`) and the AI database (`ai_metadata.db`) at the end of the cleanup routine to reclaim physical disk space and optimize queries.

## v1.0.0

### 🚀 Major New Features & Enhancements
*   **System Tray (Taskbar) Icon:** Added a system tray taskbar icon using `pystray`. The icon provides options to open WABS (Dashboard), open Settings, or gracefully Shutdown the backend. It runs in a background thread and removes itself cleanly on shutdown.
*   **Auto Run on Startup:** Introduced an "Auto run on startup" configuration toggle in Settings. Enabling this configures WABS to run automatically on user login in background mode (`--no-browser` and hidden console/terminal) for both Windows (using a startup registry key) and Linux/Ubuntu (using an XDG `.desktop` autostart entry).
*   **Offline OCR (Optical Character Recognition) Integration:** Integrated **RapidOCR** with local PaddleOCR models (`paddleOCR_det.onnx`, `paddleOCR_rec.onnx`, `paddleOCR_dict.txt`) to extract English text from photos and scanned/image-only PDF pages. Extracted text is indexed into the Full-Text Search (FTS5) engine, making them instantly searchable.
*   **GPU Acceleration for OCR:** Added automatic detection of GPU execution providers in ONNX Runtime (such as CUDA, DirectML, and ROCm). If a GPU is present, WABS configures the OCR engine to use it for hardware-accelerated text recognition, falling back dynamically to CPU otherwise.
*   **Smart Photo Filtering setting (`ocr_only_no_ai_tags`):** Added a new filter setting (default: `True`) that skips OCR on photos that already have detected faces or objects. This focuses text recognition resources specifically on receipts, invoices, screenshots, and scanned documents, while bypassing scenic/family photos to optimize processing speed and database size.
*   **Single-Decode Image Reuse:** Optimised the scanner pipeline to load and decode images exactly once, reusing the same OpenCV image object across face detection, object classification, and OCR text extraction.
*   **Advanced Performance & Threading Control:** Added new settings in the **Advanced Performance Tuning** section under Settings to restrict OCR CPU thread count (`ocr_cpu_threads`) and OpenCV/DNN (Face/Object/Media) thread count (`opencv_cpu_threads`) dynamically at startup, avoiding 100% CPU spikes and keeping your computer responsive.
*   **Early-Downscaling Image Pipeline:** Introduces early resizing of huge images to 2000px max side when OCR is enabled. Subsequent Face and Object detection algorithms resize from this pre-downscaled image, avoiding high memory footprint and CPU processing spikes on massive camera photos.
*   **Unified UI Controls:** Renamed "Extract Document Text" to "Extract Text" across the dashboard and tags page, adapting the button and progress components to process both documents and photos when OCR is enabled.
*   **Third-Party Acknowledgments:** Updated the About page and documentation to attribute proper credits and license details to PaddleOCR and RapidOCR.
*   **Fast Startup via Deferred Lazy Imports:** Optimized the backend initialization time down from ~8 seconds to under 2 seconds. Deferred importing of heavy packages (`cv2`, `fitz`, `docx`, `pptx`, `openpyxl`, `mutagen`, `pefile`, and `filetype`) from module-level to function-local/on-demand execution scope.
*   **Dynamic Memory Unloading & Idle Monitor:** Introduced automatic memory release when WABS is idle. A background monitor thread tracks user activity, checks if any scanners are running, and automatically unloads heavy Python libraries (`fitz`, `docx`, `pptx`, `openpyxl`, `mutagen`, `pefile`, `filetype`) from the `sys.modules` cache when inactive for a configured timeout (5m, 10m, 30m, 1h).
*   **Synchronized Thread-Safe Imports:** Coordinated both dynamic on-demand imports and background module unloading using a global application-level lock (`MEMORY_LOCK`) to ensure absolute stability and prevent race conditions if a user performs operations during memory release.
*   **Memory Management UI Settings:** Added a new "Memory Management" section in the General Settings panel, allowing users to toggle idle memory release and configure the idle timeout threshold. Mapped the dynamic unloading to the `/system/free-memory` endpoint to allow manually releasing memory on demand.
*   **DirectML & OpenCL HW Acceleration:** Enhanced the ONNX Runtime execution provider configuration to support DirectML (`DmlExecutionProvider`) on Windows with automatic fallbacks. Added OpenCL (`cv2.ocl`) acceleration for OpenCV DNN models when CUDA is not present.
*   **EXIF Portrait Photo Rotation:** Implemented native EXIF orientation handling inside the OpenCV decoding pipeline. Upright rotation is applied via `cv2.rotate` after decoding, ensuring correct orientation for YuNet face/object detection and OCR text extraction.
*   **Vectorized Face Similarity:** Stacked face embeddings into a single 2D NumPy array to perform matrix-vector dot products via `np.dot` in matching loops, accelerating similarity checks as the database grows.
*   **Batch Face Matching Buffer:** Implemented in-memory buffers (`new_embs` / `new_ids`) during face-matching runs. Newly discovered face clusters are immediately considered for subsequent faces in the same batch, avoiding redundant database writes and boosting accuracy.
*   **Scale-On-Decode (OCR):** Enabled OpenCV's native scale-on-decode (`IMREAD_REDUCED_COLOR_2`) to decode large images (>3000px) at 1/2 size when OCR is active, significantly saving memory and processing overhead.
*   **Document Scanner Sync:** Added a `run_document_scan` setting in the backend and synced the dashboard checkboxes (Face, Object, and Document scanners) with the frontend's persistent options in `localStorage`.
*   **Custom PyInstaller Spec:** Replaced the generic PyInstaller config with a dedicated `WABS-Windows.exe.spec` file that dynamically names the executable via workflow variables, excludes large unused libraries like `tzdata` and `pyarrow` to reduce package size, and correctly packages frontend assets.

### 🐞 Bug Fixes & Refinements
*   **RapidOCR Model Loading Fix:** Patched RapidOCR parameter mapping so that custom model paths in the `backend/` directory are loaded correctly instead of falling back to default site-package paths.
*   **GPU Module Enablement Fix:** Corrected ONNX Runtime execution provider configuration inside the OCR session to properly activate GPU acceleration for both detection and recognition modules when GPU is present.
*   **OCR Image Scaling & Safety:** Configured WABS to skip OCR on extremely small images (<20px) and scale up/pad small images (<150px) to prevent internal upscaling issues in PaddleOCR.
*   **GPU Stability Verification & Fallback:** Added startup stability verification tests for Face Detection, Face Recognition, and Object Classification models on the GPU. If a GPU backend fails or runs into driver issues, WABS automatically and gracefully falls back to CPU to ensure stable execution.
*   **Clearer Scanning & Indexing Logs:** Added detailed user-facing log entries for backup scanning/indexing paths and when no valid roots are found, as well as clearer OCR rescale action details.

## v1.0.0-beta.8

### 🚀 Major Refactoring & New Features
*   **Randomized Auto-Pick Cover:** Refactored "Auto-Pick Cover" to select cover photos dynamically and randomly from the top candidate covers (within 50% of the best score, up to 5 candidates). Excludes the current cover photo (if others exist) to rotate covers and prevent getting stuck on the same image.
*   **Indexer Start/Stop Responsiveness & Lazy Preloading:** Added stop/shutdown checks inside directory walking (`os.walk`) loops in both the main indexer and unified scanners. Replaced full table metadata preloading on startup with dynamic chunked lazy preloading (1,000 files at a time) during runs. Bypasses completion delays on manual stop, making start/stop instant even on massive databases.
*   **Modular Architecture:** Refactored Backend (`main.py`) and Frontend (`App.jsx`) from a monolithic structure to multiple routes, pages, hooks, etc., making the application modular and easy to maintain.
*   **Smart Cleanup Safety Filter**: Protects configured backup paths that are currently offline (e.g. unplugged external USB drives or network shares) from being accidentally purged during database cleanup operations. Compares directories using a drive-letter-invariant matching method.
*   **Multi-Scale Face Detection Fusion**: Runs two concurrent detection passes when `face_sensitivity` is set to `high` (1024px for small/distant background faces, and 320px for large foreground close-ups) and fuses overlapping boxes using Non-Maximum Suppression (NMS) to capture both background and foreground faces accurately.
*   **Standardized Tag Delimiter:** Standardized all database file tags to be comma-separated `,` instead of space-separated, enabling correct indexing, display, and search for multi-word tags (e.g., `person:John Doe` or `object:cell phone`). Implemented robust synchronization and backward compatibility in parsing.
*   **DNG RAW Photo Support:** Added full raw DNG photo indexing, face/object scanning, and browser-compatible JPEG preview rendering fallbacks.
*   **Unified Document Scanning Depth:** Introduced `document_scan_depth` configurations (`low`, `medium`, `high`) dynamically scaling limits across all document types (PDFs, Word, PPT, Excel, Text) inside WABS Settings.
*   **Memory-Optimized Hybrid Scanning:** Implemented hybrid document parsing that fully tokenizes text under configured limits and scans only for strong alphanumeric identifiers (emails, URLs, hashtags) beyond limits using 128KB chunks and 1,000-count early breakout checks.
*   **Context-Preserving Capping:** Frequency-sorts and caps boosted identifiers (top 50 strong identifiers, top 100 multi-word proper nouns) to prevent document metadata from crowding out core context keywords during indexing.
*   **High-Efficiency Face Export & Import:** Redesigned the export and import utility to serialize 128D face embeddings as compact binary `float32` Base64 strings, saving ~72% of the space for embeddings.
*   **Memory-Safe Frontend Downloads:** Replaced the browser `data:` URI scheme with memory-safe `Blob` and `URL.createObjectURL(blob)` components in `exportKnownPeople` to prevent browser hangs or freezes on large backups.

### ⚡ Performance & Caching
*   **Fast JPEG Scale-on-Decode**: Integrates header-only dimension reads (via Pillow) and leverages OpenCV's native scale-on-decode capabilities (`cv2.IMREAD_REDUCED_COLOR_*`) to decode large images at 1/2 or 1/4 size directly, reducing image load times by 5x-10x.
*   **Dynamic Chronological & Size Curation**: Implemented a central curation helper (`get_or_create_exemplars`) that curates up to 15 exemplars. For profiles > 15 faces, it samples 50 timeline-distributed files, filters out the bottom 25% blurriest using Laplacian variance, and selects the oldest, newest, middle, smallest, and largest faces before backfilling. Includes a 0ms SQL bypass for small profiles (<= 15 faces).
*   **In-Memory Exemplar Curation:** Replaced slow disk-based face exemplar curation with a fast (under 5ms), 100% in-memory NumPy curation selecting the centroid, 8 typical representations, 6 diverse boundary faces, and 10 timeline-distributed chronological faces.
*   **In-Memory Caching on Import:** The `/system/import-people` route now caches full SQLAlchemy `FileIndex` model objects by path, eliminating redundant DB lookup queries when verifying tags and mapping thumbnails.

### 🐞 Bug Fixes & Refinements
*   **Scanner Graceful Shutdown:** Configured background scanning threads as daemon threads and mapped `APP_SHUTTING_DOWN` state checks to immediately exit long-running loops on application shutdown.
*   **Manual Tagging Logs:** Added logging statements for manual tagging/untagging operations under backend `enable_logging`.
*   **Untagged Media Count & SQL NULL Evaluation:** Solved the bug where "Untagged Media" statistics incorrectly returned near-zero counts on fully scanned archives. Corrected both the `/stats` calculation and the `/files` category queries to properly evaluate SQL `NULL` column behaviors for untagged photos.
*   **Tags Export NameError:** Fixed a `NameError` crash inside `/system/export-tags` by adding the missing `load_config` import.
*   **Global Import Transaction Safety:** Wrapped the people profile import workflow in transactional boundaries to automatically roll back session/DB connections on failure and bubble up clear HTTP exceptions.

### 📝 Documentation
*   **AI Runner Setup Polish:** Updated local LLM configurations in `README.md` to recommend standard OpenAI-compatible base URLs for Ollama (`http://127.0.0.1:11434/v1`) and LM Studio (`http://127.0.0.1:1234/v1`) along with the model config name (`tinyllama`).
*   **Architecture Document:** Expanded the AI computer vision section in `ARCHITECTURE.md` to cover the Base64 float32 serialization scheme, import logic, tag delimiter standardization, and centroid similarity matching.

## v1.0.0-beta.7
**Full Changelog**: https://github.com/wizwin/WABS/commits/v1.0.0-beta.7

### 🚀 Major New Features
*   **Document Text Extraction & Search:** Introduced a powerful new text extraction pipeline for documents (PDF, DOCX, PPTX, XLSX, and text/code files). Extracted keywords are indexed into a new FTS5 virtual table (`file_text_fts`), allowing you to instantly search for files based on their contents. Added dedicated start/stop/reset controls in the UI for the document scanner.
*   **AI Search Assistant:** Added experimental support for LLM-powered natural language searches. WABS can now translate natural language prompts into valid WABS search queries (e.g., "Find photos of cars from 2022"). Configurable in Settings with connection testing.
*   **Favorite (Pinned) People:** You can now pin or favorite specific people on the People page. Pinned individuals will always remain sorted at the top of the grid for quick access.
*   **Hardware Acceleration:** Added hardware acceleration support for OpenCV video frame extraction and CUDA support for DNN (Deep Neural Network) modules, significantly improving media processing speeds.

### ✨ UI/UX Enhancements
*   **Multi-Person Manual Tagging:** Replaced the single-select auto-assign dropdown with a robust multi-select component (Select + Add/Remove buttons) for manual person tagging.
*   **Intelligent Undo & Refresh:** Vastly improved the undo action for tagging. Reverting a tag now flawlessly refreshes the UI, dashboard statistics, and maintains your selected file states without manual page reloads.
*   **Bi-Directional Pagination & Lazy Rendering:** The frontend now supports bi-directional pagination and utilizes `IntersectionObserver` for lazy rendering of Date Groups, providing buttery-smooth scrolling on massive archives. Chunk limits are now configurable in Settings.
*   **Streaming API Responses:** Converted file, search, and people-photo endpoints to use streaming JSON responses, dramatically reducing frontend wait times when loading large sets of results.
*   **Advanced Date Normalization:** Enhanced EXIF date parsing and formatting (`json_extract` caching). The timeline and date-range queries now correctly handle diverse formatting, including colon replacement.
*   **Sort Presets & Propagation:** File sorting preferences are now persisted to `localStorage` and correctly propagated to backend file and search requests.
*   **Merge People Improvements:** The flow for merging people now proactively surfaces potential name conflicts to prevent accidental overwrites.
*   **Image Loading & Retry:** Implemented automatic image retry with exponential backoff and error handling for robust thumbnail loading.

### 🐞 Bug Fixes & Performance
*   **Path Mapping & Safe Deletion:** Added configurable `path_mappings` during indexing to normalize paths across different OS environments. Removed the risk of accidental deletions by gating missing-file removal behind `allow_delete_missing` or explicit `force_reindex` flags.
*   **Binary Newline Counting:** Switched text/code line counts to highly optimized binary newline counts, greatly improving performance on large code repositories.
*   **LLM Provider Enhancements:** Hardened the AI tagging integration (`llm_classify`) by normalizing provider URLs, intelligently appending `/chat/completions`, including file metadata in prompts, and sanitizing LLM responses.
*   **Database Startup Optimizations:** The backend now creates necessary DB expression indexes automatically at startup and safely suppresses harmless Windows asyncio `ConnectionResetError`s.
*   **Exact Match Operator:** Added support for the `=` operator in size and length filters (e.g., `size:=1MB`).
*   **Keyword Limit Configuration:** Introduced a new `text_extraction_limit` (default 300 words) setting in the backend, fully exposed to the frontend Settings UI, giving you control over document scanning depth.
*   **Memory & Resource Safety:** Improved OpenCV backend selection, added safety limits to prevent crashing on exceptionally large EXIF blobs, and improved text-to-SVG generation to prevent memory spikes.

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
