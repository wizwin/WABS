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