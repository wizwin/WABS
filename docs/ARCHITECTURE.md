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
* **Metadata Extraction:** Utilizes `Pillow` for EXIF data, `OpenCV` (`cv2`) for video frames, and `PyMuPDF` (`fitz`) for PDF parsing.
* **Batch Processing:** Uses SQLAlchemy `bulk_update_mappings` and specific column queries to bypass ORM overhead, committing in large batches to maintain extremely low memory usage and high speed when indexing massive archives.
* **AI Categorization:** Includes a background thread that asynchronously queries LLMs (like OpenAI GPT) to categorize unknown file extensions.

### 2. The API Server (`main.py`)
A FastAPI server running on Uvicorn that serves both the REST API and the React frontend.
* **Dynamic Previews:** Generates SVG representations of text/code files on-the-fly to ensure instant load times without heavy thumbnail caches.
* **Multi-Archive Path Remapping:** Seamlessly translates missing indexed paths across multiple configured backup locations if the user migrates their archives to new drive letters or network shares.
* **Data Safety:** Implements both global and per-location Read-Only modes to protect specific archives from accidental destructive operations (Move/Delete).
* **OS Integration:** Triggers OS-level commands (e.g., `start`, `open`, `xdg-open`) to launch files directly from the browser into local desktop applications.

### 3. The Frontend (`App.jsx`)
A responsive, Single Page Application (SPA).
* **Virtualization-Ready:** Dynamically fetches paginated records (offset/limit) to keep the UI fluid with 100,000+ files.
* **Offline Ready:** All Material UI icons are bundled locally so the application functions flawlessly in air-gapped environments.

### 4. Configuration Security (`config.py`)
To protect sensitive data (like the OpenAI API Key) from plain-text exposure without requiring user-managed master passwords or OS-dependent Keyring libraries, WABS implements a zero-dependency **Hardware-Bound Stream Cipher**.

**1. Hardware Key Derivation**
When the application saves the configuration, it reads the host's physical and logical signature (`Hostname` + `MAC Address` + `OS Platform`). This combined signature acts as a seed and is passed through `PBKDF2-HMAC-SHA256` with 100,000 iterations and a static salt to derive a highly secure 32-byte (256-bit) encryption key.

**2. Stream Cipher Encryption**
For every save operation, a new, cryptographically secure 16-byte Initialization Vector (IV) is generated using `os.urandom(16)`. The 256-bit hardware key, the random IV, and a counter are continuously fed into a SHA-256 hashing function to generate a keystream. The plaintext API key is XOR'd against this keystream, completely masking the data.

**3. File Storage & Portability**
The final payload (IV + Ciphertext) is Base64 encoded and written to `config.yaml` as `openai_api_key_enc`, and the plain-text key is completely stripped from the disk. Because the encryption key is tied to the hardware environment dynamically at runtime, stolen or copied `config.yaml` files are mathematically unreadable on any other machine.

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
* **Thread-Safe LRU Exemplar Cache:** A highly optimized, thread-safe memory cache (`LRUCache` with `threading.Lock()`) maintains the mathematical models of actively viewed profiles. It evaluates bounding box sizes and Laplacian variance (sharpness) to build a curated 25-photo baseline per person, dropping blurry outliers for superior matching accuracy.
* **Vectorized Face Clustering:** When faces are detected, their numerical embeddings are compared against cached clusters using fully vectorized `numpy.dot` matrix multiplications. This eliminates slow Python math loops, clustering thousands of faces in milliseconds. "Unknown Person" profiles are dynamically generated and can be renamed, explicitly hidden, clustered together in memory-safe batches, reclassified/broken apart, or purged via the UI.
* **Smart Cover Selection:** The AI engine provides an "Auto-Pick Cover" utility that analyzes raw images in the background to automatically elect the sharpest, largest face crop as the representative thumbnail for any person.
* **Object Tagging:** Photos are passed through the MobileNetV2 classifier. Softmax probabilities are checked against user-defined "Sensitivity" thresholds before being injected into the file's searchable `tags` column as an `object:` prefix, instantly becoming available to the FTS5 search engine.