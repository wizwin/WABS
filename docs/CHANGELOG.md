# WABS Changelog

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
