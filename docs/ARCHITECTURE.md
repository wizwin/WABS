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
* **Batch Processing:** Uses SQLAlchemy bulk commits and `yield_per` to maintain low memory usage when indexing massive archives.
* **AI Categorization:** Includes a background thread that asynchronously queries LLMs (like OpenAI GPT) to categorize unknown file extensions.

### 2. The API Server (`main.py`)
A FastAPI server running on Uvicorn that serves both the REST API and the React frontend.
* **Dynamic Previews:** Generates SVG representations of text/code files on-the-fly to ensure instant load times without heavy thumbnail caches.
* **Path Remapping:** Seamlessly translates missing indexed paths if the user migrates their archive to a new drive letter.
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