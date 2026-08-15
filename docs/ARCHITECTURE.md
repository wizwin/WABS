# WABS Architecture & Implementation

WABS is built with a modern, decoupled client-server architecture but packaged into a single standalone executable.

## Technology Stack
* **Frontend:** React, Vite, Material UI (MUI)
* **Backend:** Python, FastAPI, SQLAlchemy
* **Database:** SQLite (Local, serverless database for rapid indexing)
* **Packaging:** PyInstaller

## Key Components

### 1. The Indexer (`indexer.py`)
A highly optimized background worker that recursively scans target directories.
* **Metadata Extraction:** Utilizes `Pillow` for EXIF data (including `.dng` raw image files), `OpenCV` (`cv2`) for video frames, and `PyMuPDF` (`fitz`) for PDF parsing.
* **Batch Processing:** Uses SQLAlchemy `bulk_update_mappings` and specific column queries to bypass ORM overhead, committing in large batches to maintain extremely low memory usage and high speed when indexing massive archives.
* **Graceful Shutdown:** Actively monitors the `APP_SHUTTING_DOWN` state across all long-running background loops (file discovery, hashing, AI categorization, system cleanup, etc.) to immediately terminate execution on shutdown, and spawns background scanner threads as daemons.
* **In-Memory Optimization & Stop Responsiveness:** Pre-fetches existing file paths into an O(1) lookup set during startup, drastically speeding up update scans by avoiding sequential database queries. For scanning, it utilizes dynamic chunked lazy preloading (1,000 files at a time) to prevent massive memory footprints and startup database locks. The directory walker and scanner loops actively check stop flags inside their inner loops to terminate execution immediately when a stop is requested.
* **Fast Scale-on-Decode & Multi-Scale Detection Fusion:** Reads raw image dimensions using fast, header-only Pillow scans and leverages OpenCV's `IMREAD_REDUCED_COLOR_*` flags to decode large JPEG images directly at 1/2 or 1/4 size. When face sensitivity is set to `high`, runs dual-scale passes (1024px and 320px) and merges overlapping boxes using Non-Maximum Suppression (NMS) with an overlap threshold of 0.4.
* **AI Categorization:** Includes a background thread that asynchronously queries LLMs (like OpenAI GPT) to categorize unknown file extensions.

### 2. The API Server (`main.py`)
A FastAPI server running on Uvicorn that serves both the REST API and the React frontend.
* **Modular Routing:** Endpoints are separated into distinct router modules (e.g., `people.py`, `tags.py`) to cleanly organize API operations and backend business logic.
* **Dynamic Previews:** Generates SVG representations of text/code files on-the-fly and forces preview generation for `.dng` raw images to render them in standard browsers.
* **Smart Cleanup Safety Filter**: Drives configured with active backup paths that are currently offline (e.g., unplugged USB drives) are protected from database cleanup, preventing accidental DB record deletions. Drives are matched using a drive-letter-invariant matching method.
* **Multi-Archive Path Remapping:** Seamlessly translates missing indexed paths across multiple configured backup locations if the user migrates their archives to new drive letters or network shares.
* **Data Safety:** Implements both global and per-location Read-Only modes to protect specific archives from accidental destructive operations (Move/Delete).
* **OS Integration:** Triggers OS-level commands (e.g., `start`, `open`, `xdg-open`) to launch files directly from the browser into local desktop applications.
* **Chunked Database Operations:** Gracefully chunks massive dataset mutations (like bulk tagging) below SQLite's parameter limits (e.g., 999 variables) to maintain stability.

### 3. The Frontend (`App.jsx`)
A responsive, Single Page Application (SPA).
* **Modular Design:** The frontend architecture is heavily decoupled, separating the UI into dedicated routing Pages (e.g., Dashboard, Explorer, People) and custom React hooks (e.g., `useAppState`, `useScanners`, `useSystemOps`) to isolate complex API and state management from the visual components.
* **Virtualization-Ready:** Dynamically fetches paginated records (offset/limit) to keep the UI fluid with 100,000+ files.
* **Optimized Rendering:** Uses strict memoization and O(1) Hash Maps instead of array operations to prevent O(N²) UI freezes when selecting and mutating thousands of profiles.
* **Offline Ready:** All Material UI icons are bundled locally so the application functions flawlessly in air-gapped environments.

### 4. Configuration Security (`config.py`)
To protect sensitive data (like the AI API Key) from plain-text exposure without requiring user-managed master passwords or OS-dependent Keyring libraries, WABS implements a zero-dependency **Hardware-Bound Stream Cipher**.

**1. Hardware Key Derivation**
When the application saves the configuration, it reads the host's physical and logical signature (`Hostname` + `MAC Address` + `OS Platform`). This combined signature acts as a seed and is passed through `PBKDF2-HMAC-SHA256` with 100,000 iterations and a static salt to derive a highly secure 32-byte (256-bit) encryption key.

**2. Stream Cipher Encryption**
For every save operation, a new, cryptographically secure 16-byte Initialization Vector (IV) is generated using `os.urandom(16)`. The 256-bit hardware key, the random IV, and a counter are continuously fed into a SHA-256 hashing function to generate a keystream. The plaintext API key is XOR'd against this keystream, completely masking the data.

**3. File Storage & Portability**
The final payload (IV + Ciphertext) is Base64 encoded and written to `config.yaml` as `ai_api_key_enc`, and the plain-text key is completely stripped from the disk. Because the encryption key is tied to the hardware environment dynamically at runtime, stolen or copied `config.yaml` files are mathematically unreadable on any other machine.

### 5. Database & Full-Text Search (`database.py`)
To achieve instant search results across hundreds of thousands of files, WABS leverages SQLite's **FTS5 (Full-Text Search)** extension.
* **Virtual Tables & Tuning:** A shadow FTS5 table is synced with the main files table via heavily scoped SQLite triggers to avoid unnecessary disk I/O. The database engine operates in `WAL` mode for high concurrency.
* **Advanced Tokenization:** Utilizes `porter` stemming and prefix indexing to guarantee lightning-fast partial and plural suffix searches.
* **Vocab & Autocomplete:** Uses the `fts5vocab` table to power lightning-fast prefix matching for real-time search suggestions directly from the search bar.
* **Fuzzy Spell-Check:** Integrates Python's `difflib` against the FTS vocab table to efficiently offer "Did you mean?" suggestions for misspelled queries.

### 6. Duplicate Verification (Lazy Hasher)
To efficiently detect and verify duplicate files without bottlenecking the initial indexing process, WABS employs a background "Lazy Hasher" (`background_lazy_hasher`).
* **Size-Based & JSON1 Pre-Filtering:** The system first queries the database to find files that share the exact same byte size. It utilizes SQLite's native `json_extract` to ignore already-hashed files at the database level, preventing massive amounts of unnecessary disk read operations for unique or verified files.
* **Chunked SHA-256 Hashing:** The background worker reads the flagged files in streaming 4MB chunks, computing a cryptographic SHA-256 hash while maintaining a tiny memory footprint, even for massive ISOs or video files.
* **Metadata Stamping:** Once computed, the hash is saved to the file's JSON metadata, allowing the frontend to confidently distinguish between unverified (size-match only) and verified (cryptographic match) duplicates.

### 7. Offline AI Computer Vision (Faces & Objects)
WABS incorporates lightweight, 100% offline computer vision models to automatically enrich the archive without relying on cloud APIs.
* **ONNX Models & OpenCV:** Utilizes OpenCV's DNN module alongside bundled ONNX models (`YuNet` and `SFace` for facial recognition, `MobileNetV2` for object/scene classification). This approach avoids bloated ML dependencies, keeping the final executable small and performant.
* **Sidecar AI Database:** All computationally expensive embeddings, clusters, and facial tracking data are stored in a completely separate `ai_metadata.db` file. This ensures the core index (`archive.db`) remains lightning-fast and clean.
* **Thread-Safe LRU Exemplar Cache & Dynamic Curation**: A thread-safe cache (`EXEMPLAR_CACHE`) stores the curated reference embeddings. The dynamic curation helper (`get_or_create_exemplars`) curates up to 15 exemplars dynamically. If a profile has $\le 15$ total faces, it bypasses disk reads entirely and loads from SQL instantly (0ms latency). For larger profiles, it samples 50 timeline-distributed files, evaluates them using fast scale-on-decode, filters out the bottom 25% blurriest faces using Laplacian variance, and applies chronological sorting (oldest, newest, middle) and size sorting (smallest, largest) to build a diverse reference baseline.
* **Dynamic Cache Invalidation:** The similarity caches are explicitly invalidated and recalculated instantly during profile mutations (rename, merge, delete, manual tag) to guarantee real-time accuracy.
* **Vectorized Face Clustering:** When faces are detected, their numerical embeddings are compared against cached clusters using fully vectorized `numpy.dot` matrix multiplications. This eliminates slow Python math loops, clustering thousands of faces in milliseconds. "Unknown Person" profiles are dynamically generated and can be renamed, explicitly hidden, clustered together in memory-safe batches, reclassified/broken apart, or purged via the UI.
* **Smart Cover Selection:** The AI engine provides an "Auto-Pick Cover" utility that analyzes raw images to automatically elect the sharpest, largest face crop as the representative thumbnail for any person. It dynamically selects a thumbnail randomly from the top-scoring candidate images (within 50% of the best score, up to 5 candidates) and excludes the current cover photo from selection (when others exist) to rotate covers and prevent getting stuck on the same image.
* **Object Tagging:** Photos are passed through the MobileNetV2 classifier. Softmax probabilities are checked against user-defined "Sensitivity" thresholds before being injected into the file's searchable `tags` column as an `object:` tag, instantly becoming available to the FTS5 search engine.
* **High-Efficiency Face Export & Import:** WABS provides a system utility to export and import known people profiles. To prevent massive JSON file sizes, the 128-dimensional face embeddings (floats) are packed into a compact binary `float32` byte array and stored as Base64 text. This reduces the embedding payload by ~72% (from ~2.4KB of JSON array text to exactly 684 characters). Additionally, the frontend uses native `Blob` and browser Object URLs to handle downloads, avoiding browser hangs/crashes. During import, the system resolves path-to-file relationships, tags the corresponding files in the database with `person:<name>`, reconstructs the thumbnail associations, and dynamically invalidates the active exemplar cache.
* **Tag Delimiter Standardization:** Database tags are strictly comma-separated `,` rather than space-separated, enabling multi-word tags (e.g., `person:John Doe`, `object:cell phone`) to be indexed and searched correctly. The parsing utility (`parse_tags`) provides robust backwards compatibility by falling back to space-based splitting for un-normalized legacy archives.

### 8. Document Text Extraction & OCR Search
To make the contents of PDFs, documents, code files, and photos searchable without bloating the database, WABS utilizes a highly optimized text extraction and OCR background worker.
* **Offline OCR (Optical Character Recognition):** Integrates **RapidOCR** (onnxruntime backend) with PaddleOCR models (`paddleOCR_det.onnx`, `paddleOCR_rec.onnx`, and `paddleOCR_dict.txt`) to extract English text from photos and scanned/image-only PDF pages. Pre-trained mobile models (~2-4MB size) are supported as a drop-in replacement for server-scale models in the backend directory.
* **GPU Acceleration:** Dynamically queries ONNX Runtime for available execution providers. If any GPU acceleration (such as CUDA, DirectML, or ROCm) is present on the host system, it automatically configures RapidOCR to run on the GPU (setting execution providers per module), falling back to CPU otherwise.
* **Advanced Performance & Threading Control:** Features user-configurable CPU core usage limits for both ONNX Runtime OCR (`ocr_cpu_threads`) and OpenCV/DNN classification tasks (`opencv_cpu_threads`). These limits are dynamically applied at startup via system environment variables (`OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `OPENCV_NUM_THREADS`) and `cv2.setNumThreads`.
* **Smart Photo Filtering:** Features a setting (`ocr_only_no_ai_tags`) that checks for the presence of face or object tags. If tags are present, it completely skips OCR on those photos. This optimizes scanning speed by preventing OCR on scenic or family photos and targeting documents, receipts, screenshots, and invoices.
* **Early-Downscaling Image Reuse:** Decodes photo files from disk (or renders PDF page 0) exactly once. If OCR is enabled, JPEGs above 4000px are scaled by 0.5 on decode. If the decoded image max dimension still exceeds 2000px, it is resized to exactly 2000px max side using `cv2.resize`. This downscaled image is then shared sequentially between OCR extraction, face detection, and object classification (rescaled further as needed), drastically reducing memory and CPU usage.
* **Heavy Filtering & Keyword Optimization:** Instead of dumping entire multi-page documents or long OCR outputs into the index, the text extractor strips noise, removes common stop words, and isolates the top most frequent meaningful words alongside important alphanumeric codes (like invoice numbers, dates, or serials).
* **Instant Search Integration:** These distilled keywords are injected directly into a dedicated SQLite FTS5 index (`file_text_fts`), ensuring that massive documents and photos are completely searchable instantly while keeping the overall database memory footprint tiny and performant.
* **Unified Scanning Depth & OCR Limits:** A user-configurable scanning depth setting (`low`, `medium`, and `high`) scales extraction limits for documents, while a dedicated `ocr_max_pages` configuration limits OCR processing to the first `n` pages of scanned PDFs to prevent database bloat.
* **Memory-Optimized Hybrid Scanning:**
  - Content within the configured scanning limit is fully parsed and tokenized into general keywords.
  - Content *beyond* the scanning limit is scanned **only** for strong identifiers (emails, URLs, social handles, hashtags) using fast regex matching, completely bypassing full word tokenization and meaning checks.
  - Plain-text files are read in small **128KB chunks** to prevent memory spikes.
  - If a file contains more than **1,000** extra identifiers, the scanner exits early, preventing performance bottlenecks on massive log files or directories.
* **Context-Preserving Capping:** To prevent long lists of links or emails (e.g., mailing list exports) from crowding out a document's core context keywords, WABS sorts all unique high-priority entities by frequency and applies strict limits:
  - **Strong Identifiers (Emails, URLs, Hashtags):** Capped at the **top 50** unique items (boosted by `100,000` to rank first). Any remaining ones are completely excluded/ignored from the index.
  - **Multi-Word Proper Nouns / Products:** Capped at the **top 100** unique items (boosted by `1,000`).
  - **Context Keywords:** All other normal keywords are stored with their raw frequency counts. Since boosted items are capped at 150 total, at least **150 slots** (out of the 300 default) are guaranteed for context words, ensuring the document is always searchable by its text context.

### 9. Code Signing & Executable Packaging (Future TODO)
For Windows distribution, standalone executables require a digital signature to bypass **Windows Smart App Control (SAC)** and **SmartScreen** blocks.
* **Current Implementation:** WABS integrates `signtool.exe` in both local build scripts (`scripts/build_windows.ps1`) and GitHub Actions CI (`build.yml`), which signs the executable using a base64-encoded certificate from private secrets. If the certificate is not configured, the signing steps are gracefully skipped.
* **Future Action / TODO:** Obtain a publicly-trusted IV/OV or EV Code Signing Certificate from a Microsoft-trusted Certificate Authority (CA) to sign official releases. This will establish permanent brand reputation and completely eliminate safety warnings for new users.

---

### 10. Virtual Folders (`virtual_folders.py`, `useExplorer.jsx`)

Virtual Folders are an organisational layer that lives entirely inside the WABS database. They let users group any combination of physical files (from different directories, drives, or archive roots) into named folder hierarchies — without moving or copying a single byte on disk.

#### 10.1 Database Models

Two SQLAlchemy models back the feature:

| Model | Table | Key Columns |
|---|---|---|
| `VirtualFolder` | `virtual_folders` | `id`, `name`, `parent_id` (self-referential FK), `is_dynamic` (0/1), `query` (saved search string), `created_at`, `metadata_json` |
| `VirtualFolderFile` | `virtual_folder_files` | `id`, `virtual_folder_id` (FK → `virtual_folders.id`), `file_id` (FK → `files.id`) |

`parent_id` is a nullable self-referential foreign key that enables an arbitrarily deep folder tree. Orphan cleanup runs on every `GET /virtual-folders` call via `cleanup_orphans()`, which deletes associations pointing to non-existent folders and child folders pointing to non-existent parents — keeping the tree consistent without requiring cascaded deletes at the DB level.

#### 10.2 File Membership: Manual vs Dynamic

Each virtual folder can hold files in two complementary ways that are **unioned together** at query time:

**Manual Links** — explicit `VirtualFolderFile` rows inserted when the user drags files or physical folders into a virtual folder. The file's physical path is never duplicated; only its integer `file_id` is stored.

**Dynamic Query Rule** — an optional `query` string saved on the `VirtualFolder` row. When resolving the folder's contents the backend evaluates the query against the FTS5 index in three modes (tried in order):

1. **Regex** — if the query matches `/_pattern_/flags` syntax, a compiled Python `re` object is applied against a concatenated `filename|path|tags|metadata_json` haystack for every file (streamed in 1,000-row batches via `yield_per`).
2. **Advanced Search** — if the query uses any known `SEARCH_PREFIX` (e.g. `person:`, `object:`, `tag:`, `ext:`, date ranges) or Boolean operators (`+`, `-`, `*`), it is fed into `_build_search_query` — the same engine that powers the main Explorer search bar.
3. **FTS5 Phrase Match** — plain text queries are split into words and rewritten as `"word" *` FTS5 prefix terms, then run against both `files_fts` and `file_text_fts` virtual tables via a `UNION`.

The resolved `manual_ids ∪ dynamic_ids` set is deduplicated in Python before being passed to the paginated file query.

#### 10.3 Recursive File & Count Resolution

Several helpers walk the folder tree efficiently:

| Helper | Strategy |
|---|---|
| `get_folder_files_recursive(s, folder_id)` | Depth-first recursion; unions manual + dynamic IDs at each level, then recurses into children. Used for per-folder file counts. |
| `get_folder_and_descendants_ids(s, folder_id)` | Single SQL query fetches **all** `(id, parent_id)` pairs into memory, then BFS produces the full descendant ID list in one pass. O(N) where N is total folder count. |
| `get_virtual_folder_file_ids_recursive(s, folder_id)` | Uses `get_folder_and_descendants_ids` to bulk-query all manual links in one `IN (…)` clause, then evaluates dynamic queries for each descendant folder in batches. Used by `GET /virtual-folders/{id}/files?recursive=true`. |

The `recursive` query parameter on the files endpoint controls whether only the requested folder's direct files are returned or the entire subtree is included.

#### 10.4 Physical Folder → Virtual Hierarchy Mirroring

When the user adds a **physical directory path** via `POST /virtual-folders/{id}/files`, the backend mirrors the physical directory tree inside the virtual folder:

1. The selected folder's name becomes a new virtual subfolder directly under the target.
2. Every file is placed in a virtual subfolder that matches its relative path segments below the physical root — creating intermediate virtual folders on-the-fly with `s.flush()` to obtain IDs before the next level.
3. Files that sit at the root of the selected folder (zero relative path segments) are placed directly in the top-level mirrored subfolder.

This allows an entire physical archive branch to be transplanted into a virtual folder in a single operation while preserving the original directory structure.

#### 10.5 Virtual Folder Copying

`copy_virtual_folder_hierarchy(s, src_folder_id, dest_parent_id)` performs a deep copy of a virtual folder tree: it creates a matching subfolder (by name, case-insensitive) under the destination, copies all `VirtualFolderFile` rows, then recurses into children. Duplicate file associations are skipped via existence checks.

#### 10.6 Export to Disk

`POST /virtual-folders/{id}/export` runs a background thread (`run_export_background`) that mirrors the virtual folder tree onto the real filesystem using `shutil.copy2`. Progress is tracked in `STATE["export_current"]` / `STATE["export_total"]` and surfaced to the frontend via the indexer status poll. Filename collisions are resolved by appending `_N` counters.

#### 10.7 REST API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/virtual-folders` | List all folders with recursive file & subfolder counts |
| `POST` | `/virtual-folders` | Create a new folder (manual or dynamic) |
| `PUT` | `/virtual-folders/{id}` | Rename, re-parent, change query, toggle dynamic |
| `DELETE` | `/virtual-folders/{id}` | Delete folder and entire subtree recursively |
| `GET` | `/virtual-folders/{id}/files` | Paginated, sorted, categorised file list (`?recursive`) |
| `POST` | `/virtual-folders/{id}/files` | Add files by ID list and/or path list (file, dir, or `virtual_folder:N`) |
| `DELETE` | `/virtual-folders/{id}/files` | Remove file associations by ID or path |
| `GET` | `/virtual-folders/{id}/subfolders` | List immediate child folders |
| `POST` | `/virtual-folders/{id}/export` | Export tree to a chosen disk path (background) |

#### 10.8 Frontend State Management (`useExplorer.jsx`)

All virtual folder state and operations live inside the `useExplorer` custom hook and are spread into `appState`, making them available everywhere in the component tree.

**Key state:**

| State | Description |
|---|---|
| `virtualFolders` | Flat list of all VF metadata objects fetched from the API |
| `currentVirtualFolder` | The VF currently being browsed (drives the right-pane file list) |
| `virtualFolderId` | Integer ID of the current VF context |
| `checkedFiles` | `Set<string>` of selected paths — entries are either file paths (`C:/…/file.jpg`) or virtual folder tokens (`virtual_folder:N`) |

**Selection model — unified implicit coverage:**

The `checkedFiles` set uses two distinct entry types. A single `findImplicitCoverage(pathOrId, isVirtualSubfolder, pool)` function unifies all coverage detection:

- **Physical ancestor** — a file path is implicitly covered if any checked entry is a path prefix of it.
- **Virtual folder context** — a file shown inside a virtual folder view is implicitly covered if the viewed VF's ID (or any of its ancestors) is in `checkedFiles`.
- **Virtual subfolder ancestry** — a virtual subfolder card is implicitly covered if any ancestor VF ID is in `checkedFiles`, detected by walking `parent_id` links.

`getImplicitSelection` is a one-liner (`!!findImplicitCoverage(…)`) consumed by `DateGroup`, `FileCard`, and the subfolder card renderer in `Explorer.jsx`. `toggleCheck` also calls `findImplicitCoverage` so that clicking an implicitly-covered item **removes the covering parent** (instead of silently adding a redundant entry), with a toast message explaining the change.

When selecting a physical **folder** (subfolder card checkbox), any more-specific children already individually checked are automatically deduplicated (removed) from `checkedFiles`.

#### 10.9 Frontend UI (`Explorer.jsx`, `FolderTree.jsx`)

**Left-pane tree** — `FolderTree.jsx` renders the virtual folder hierarchy alongside the physical directory tree. Each VF node shows its name and file count, and clicking navigates into it (sets `page='virtual_folder'`, `virtualFolderId`).

**Right-pane subfolder grid** — when browsing a virtual folder, the top of the file list shows immediate child VFs as subfolder cards. Each card displays: folder icon, name, file/subfolder counts, a teal/blue checkbox (teal = implicitly covered by a parent selection), and a context menu for rename/delete/export.

**Breadcrumb** — a path bar shows the ancestry chain of the current VF, with each segment clickable to navigate up.

**Dynamic query badge** — VFs with an active `query` show a purple label and the query string, making Smart Folders visually distinct from manual folders.

**Actions available on selected virtual folders** (via the selection action bar):
- Add to another Virtual Folder (moves the VF hierarchy by copy)
- Delete (removes the VF and its subtree; does **not** touch files on disk)
- Export to disk (copies files replicating the VF tree structure)

---

### 11. Social Taxonomy & Relationship Sidecar (`relationships.db`, `relationships_database.py`)

WABS includes a dedicated social categorization layer to enrich photo searches (e.g. finding photos of family members, cousins, spouses, or colleagues) and visualize kinship networks without turning WABS into a complex genealogy management application.

#### 11.1 Sidecar Database Isolation

WABS maintains strict structural isolation across its databases:

1. `archive.db` — Core physical index (`files`, `virtual_folders`). Fast, read-heavy, zero AI overhead.
2. `ai_metadata.db` — Machine-generated face clusters and high-dimensional float embeddings (`people`, `faces`, `processed_files`). Can be completely wiped, purged, or rescanned at any time.
3. `relationships.db` — User-curated social relationships, kinship ties, and identity metadata (`persons`, `person_social`).

```
                    ┌─────────────────────────┐
                    │      config.yaml        │
                    │   (me_name, filters)    │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    archive.db    │  │  ai_metadata.db  │  │ relationships.db │
│  (Indexed Files, │  │ (Face Clusters & │  │ (Stable Registry,│
│ Virtual Folders) │  │   Embeddings)    │  │  Social Mapping) │
└──────────────────┘  └──────────┬───────┘  └──────────┬───────┘
                                 │                     │
                                 └────── Soft-Link ────┘
                                      (ai_person_id)
```

#### 11.2 Soft-Link Preservation on Database Rescans

When `ai_metadata.db` is purged or face clusters are re-evaluated:
* The user's relationship classifications (`relationships.db`) remain **100% intact**.
* `persons` records hold stable primary keys (`id`, `name`) and store `ai_person_id` as a loose/soft link.
* If a person is deleted from `ai_metadata.db`, the link is soft-unlinked (`ai_person_id = NULL`).
* When the person is re-scanned or renamed in `ai_metadata.db` with the same name, `relationships.db` automatically soft-relinks the existing relationship data without manual user intervention.

#### 11.3 Database Schema

| Table | Column | Type | Purpose |
|---|---|---|---|
| `persons` | `id` | INTEGER PRIMARY KEY | Stable identity ID across AI database resets |
| | `name` | TEXT UNIQUE NOT NULL | Canonical person name |
| | `ai_person_id` | INTEGER | Soft reference to `ai_metadata.db.people.id` |
| | `is_me` | BOOLEAN | Indicates if this profile represents the primary WABS user |
| | `linked_at` | DATETIME | Timestamp of last link sync |
| | `created_at` | DATETIME | Record creation timestamp |
| `person_social` | `person_id` | INTEGER PRIMARY KEY | References `persons.id` (CASCADE DELETE) |
| | `category` | TEXT | Primary classification: `Family`, `Friends`, `Others` |
| | `subcategory` | TEXT | Kinship or social tier (e.g. `Spouse`, `Parent`, `Sibling`, `Close Friend`, `Colleague`) |
| | `relation_label` | TEXT | Free-form user label (e.g. "Wife", "Sister", "College Roommate") |
| | `updated_at` | DATETIME | Timestamp of last relationship change |

#### 11.4 Hierarchical Relationship Tree (`RelationshipTree.jsx`)

The frontend visualizes the kinship network anchored to the primary user profile (`"Me"`):
* **Multi-Column Modular Cards**: Organizes categories (`Family`, `Friends`, `Others`) in responsive side-by-side card containers with live photo counters and person badges to minimize vertical scrolling.
* **Instant Filtering & Expansion**: Includes real-time search filtering across branches and one-click "Expand All" / "Collapse All" actions.
* **Tree Structure**:
  - `Root (Me)` ➔ `Family` (Spouse, Parents, Siblings, Children, Grandparents, In-laws, Extended Family: Cousins 1st/2nd, Aunts/Uncles, Nieces/Nephews, Other Family)
  - `Root (Me)` ➔ `Friends` (Close Friends, Colleagues, Classmates, Acquaintances, Other Friends)
  - `Root (Me)` ➔ `Others` (Neighbors, Service Contacts, Other)
* **Interactive Navigation**: Clicking any person node opens the tagged photo collection for that person directly in `person_files` view.

#### 11.5 Search Integration & Kinship Enrichment

Every `GET /people` query joins the stable social taxonomy in memory. Search queries in the People page and Person tagging bar match against `category`, `subcategory`, and `relation_label`, allowing instant discovery by terms like `"wife"`, `"sister"`, or `"colleague"`.