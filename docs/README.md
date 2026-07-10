
# WABS (WiZarD's Archival and Backup Search)

> "How do I quickly find files, photos, videos, documents, installers, and backups spread across years of optical media and HDD archives?"

WABS is a modern, 100% offline archival management system designed to help you organize, search, and browse your digital backups. It provides a lightning-fast Explorer-style interface to manage hundreds of thousands of files across different drives.

## Features
* **Lightning-Fast Search:** Find files instantly by name, path, tags, or metadata using advanced operators (e.g., `size:>1GB`, `date:2020-2022`).
* **Smart Searches:** Save your most-used and complex search queries as one-click shortcuts.
* **Explorer-Style Browsing:** Navigate your archives with familiar grid and list views.
* **Rich Previews:** Auto-generates thumbnails for photos, videos, PDFs, Word documents, and code.
* **Smart Categorization:** Automatically groups files into categories like Photos, Videos, Code, etc.
* **Offline Face Recognition:** Scans photos using local AI to find and group people automatically.
* **Object & Scene Tagging:** Classifies objects and scenes in photos completely offline, allowing you to easily search by content.
* **Document Text Extraction:** Automatically extracts and intelligently filters text from PDFs, documents, and code files, making their inner contents instantly searchable.
* **Combined Background Scanning:** Scan for files, faces, objects, and document text simultaneously to massively speed up index generation.
* **Advanced JSON Search:** Native, high-speed metadata querying (FPS, Camera Model, ID3 Tags, etc.) powered by SQLite's JSON1 extension.
* **Virtual Folders:** Create custom, cross-drive folder views that group any files from your archive regardless of where they physically live. Supports both manual curation and smart dynamic rules.
* **Database Management:** Built-in tools to cleanly remove missing files, purge orphaned AI profiles, and vacuum the databases to reclaim disk space.
* **Portable:** Move your backup drives around? WABS easily remaps your indexed files to new drive letters.

## Getting Started

### 1. Download
Head over to the **Releases** page and download the latest standalone executable for your operating system.

### 2. Run
Place the downloaded file anywhere on your computer and double-click to run it. No installation required!

*(Note: On Windows, "Smart App Control" or "SmartScreen" may block the application from executing because it is unsigned. To bypass this, right-click the downloaded `WABS-Windows.exe` file -> select **Properties** -> check **Unblock** at the bottom of the General tab -> click **Apply** / **OK**).*

*(Note: On Linux, you may need to make the file executable first by running `chmod +x WABS-Linux` in your terminal)*

### 3. Access
Once the terminal window opens and the backend starts, open your web browser and navigate to:
`http://127.0.0.1:8000`

## How to Use
1. **Set Up Paths:** Go to **Settings** and specify your `Backup Path`, `Database Path`, and `Thumbnail Path`.
2. **Index Files:** Go to the **Dashboard** and click **Start** under Indexer Controls.
3. **Explore:** Use the **Explorer** and **Search** tabs to navigate and manage your data.

### Managing Face Scanning & AI People Profiles

Once the Face Scanner identifies faces, it groups them under automatic profiles in the **People** tab. You can manage these profiles using several built-in AI tools:

1. **Naming & Auto-Merging:**
   * Rename an "Unknown Person #X" profile to a person's real name (e.g., `John Doe`).
   * If the name already exists, WABS will **automatically merge** the profiles, moving all faces to the existing person and updating the file tags.

2. **Bulk AI Operations (top of the Unknown People list):**
   * **Cluster All Unknowns:** Compares all unknown profiles against each other to automatically merge similar faces together.
   * **Reclassify All Unknowns:** Dissolves all unknown profiles and re-evaluates every face against all named/known persons and unknown groups.
   * **Purge Small Profiles:** Automatically deletes unknown profiles with fewer than a specified number of photos (e.g., <3) to reclaim space and clean up noise/blurry faces.

3. **Selected AI Operations (appears in the floating bottom panel when selecting checkboxes):**
   * **Cluster Selected:** Compares only the selected unknown profiles against other unknowns and merges matches.
   * **Reclassify Selected:** Dissolves only the selected unknown profiles' collections, re-evaluating each face against all named/known persons and other unknowns. This is extremely useful if you just named a person (e.g., `Mary`) and want to check if a few specific unknown profiles contain her faces.

4. **Merging Duplicate Unknowns (Resolving split profiles):**
   * If a face scan finishes and you see multiple separate "Unknown Person" profiles that are actually the same person, you can merge them easily:
     * **If they are all unnamed:** Use **Cluster All Unknowns** to compare all unknown profiles against each other in bulk and merge duplicates automatically.
     * **If you have already named one of them (e.g., `John Doe`):** Go to `John Doe`'s profile page and click **Find Similar Unknowns** (or **Find Similar Faces**) in the Details pane. WABS will scan the remaining unknown profiles and let you merge them with one click.
     * **Adjusting Sensitivity:** If some duplicates still won't merge, expand the **AI Actions** panel on the People page and lower the **Similarity Threshold** slider slightly (e.g., to `50%` or `52%`) to be more lenient with side-profiles, shadows, or hats.

### Clearing AI Data & Text Manually
If you want to completely reset the AI's detected faces, people, and object tags, you can manually clear the AI database (or the text extraction cache):
1. **Stop** the WABS application (close the terminal/command prompt window).
2. Open your file explorer and navigate to the folder you configured as your **Database Path** in WABS.
3. Locate and delete the `ai_metadata.db` file. *(Note: Do not delete your main `archive.db` file as that contains your core file index).*
4. **Restart** WABS. The application will automatically create a fresh, empty AI database on startup.
5. You can now go to the Dashboard and start the AI scanners to re-process your archive from scratch.

*(Note: You can also clear just the object tags or extracted document text directly from the UI by navigating to the **Tags** page).*

### Exporting & Importing AI Data (JSON)
To safeguard your AI metadata against database wipes or migrations, you can export your data to portable JSON files:
1. Go to **Settings** and scroll down to the **Data Management** section.
2. Click **Export JSON** under **Known People (Faces)** or **Object & Custom Tags** to save your data.
3. To restore, simply click **Import JSON** and select your saved file. 
*Note: WABS uses a **Smart Path Fallback Matcher**, meaning your exported tags and faces will successfully import and remap to your files even if you have moved your archive to a completely different drive letter!*

### Using Virtual Folders

Virtual Folders let you create **custom, logical groupings** of files from anywhere in your archive — across drives, discs, or directory structures — without moving or copying a single file.

#### Creating a Virtual Folder
1. In the **Explorer** sidebar, right-click on **Virtual Folders** and select **New Virtual Folder**, or use the **+** button next to the section heading.
2. Give the folder a name. It will appear in the sidebar alongside your physical drive tree.

#### Adding Files Manually
1. Browse to any physical folder or search result in the Explorer.
2. **Select** one or more files or entire folders using the checkboxes.
   * Checking a physical folder automatically covers all files inside it (and any subfolders) — a blue parent indicator shows partial coverage.
   * You can also deselect individual items within a selected parent to fine-tune your pick.
3. Right-click the selection and choose **Add to Virtual Folder**, then pick your target folder.

#### Dynamic Rules (Smart Content)
Each Virtual Folder can have **dynamic query rules** that automatically pull in matching files every time you open the folder:
* **Path Prefix** — includes every file whose path starts with a given prefix (e.g., all files from a specific disc or directory branch).
* **Keyword / Phrase** — includes files whose names or extracted text contain a search term.
* **Regex** — includes files matching a regular expression pattern.

Dynamic members are combined with manually linked files at query time — no duplicate storage is needed.

#### Subfolders & Nesting
Virtual Folders can be nested inside other Virtual Folders, creating a hierarchy. Opening a parent folder shows both its own files and any Virtual Folder subfolders it contains. You can navigate the tree just like a physical directory.

#### Selection Behavior
The selection system treats Virtual Folders consistently with physical folders:
* **Selecting a Virtual Folder** implicitly covers all its member files (manual + dynamic). A ✓ badge indicates full selection.
* **Partial selection** is shown with an indeterminate indicator when only some members are checked.
* **Deselecting** a child item removes it from the selection without affecting the rest of the parent's contents.
* Selection state is used by batch operations (export, tagging, deletion) — exactly the same as with physical folders.

#### Exporting Virtual Folder Contents
When you trigger an export with a Virtual Folder selected, WABS resolves all member file IDs (manual links ∪ dynamic query matches) and applies the export operation to the full resolved set.

---

### Advanced Search Operators
WABS supports powerful search operators to help you precisely filter your archive. You can combine multiple operators with spaces (e.g., `type:video length:>1h`).
* **`name:`** Exact filename match (e.g., `name:vacation.mp4`)
* **`type:`** Filter by category or extension (e.g., `type:audio`, `type:pdf`)
* **`size:`** Filter by file size using relational operators (e.g., `size:>1GB`, `size:<500MB`)
* **`length:`** Filter video/audio by duration (e.g., `length:>5m`, `length:<1h`, `length:300`)
* **`date:`** Filter by modification date or range (e.g., `date:2020-2022`, `date:2023-10-25`)
* **`object:`** Search for AI-detected objects or scenes (e.g., `object:car`, `object:beach`)
* **`person:`** Search for specific people identified by the Face Scanner (e.g., `person:"john doe"`)
* **`tag:`** Search for your custom manual tags (e.g., `tag:family_trip`)
* **Specific Metadata:** Filter natively by extracted attributes using `camera:`, `resolution:`, `fps:` (supports relational operators, e.g., `fps:>=60`), `artist:`, `album:`, and `genre:`.
* **`meta:`** Catch-all to search any arbitrary JSON metadata extracted during indexing (e.g., `meta:CompanyName:Microsoft` or `meta:gps.latitude:45.0`).
* **Wildcards:** Use `*` for partial matches (e.g., `*vacation*`, `*.mp3`)

### Configuring Local AI (Free & Offline)
WABS supports using local LLMs (like LM Studio or Ollama) to automatically categorize unknown files securely on your own machine.
1. Go to **Settings** and check **Enable AI Classification**.
2. In the **AI Provider Base URL** field, enter your local runner's chat API endpoint:
   * *LM Studio:* `http://127.0.0.1:1234/v1`
   * *Ollama:* `http://127.0.0.1:11434/v1`
3. In the **AI Model** field, configure your local model name:
   * *LM Studio:* (configured in LM Studio UI)
   * *Ollama:* `tinyllama` (or your preferred local model)
4. You can leave the **OpenAI API Key** field completely empty!

## Notes & Limitations

* **AI Recognition Accuracy:** WABS utilizes lightweight, 100% offline models for Object and Face recognition to prioritize speed, privacy, and a small resource footprint. Because of this, detection is not 100% accurate and may have limitations depending on image quality, angles, or challenging lighting conditions.

* **Document Text Extraction:** To keep the database extremely lean and ensure instant search results, the document text extractor does not index the entire raw text of large files. Instead, it filters out noise and extracts only the top most frequent meaningful words alongside important alphanumeric codes (like serial numbers or dates).

### Security Note: Hardware-Bound API Keys
WABS uses **Hardware-Bound Encryption** to protect your OpenAI API key from plain-text exposure. When you save your API key, it is encrypted using a unique fingerprint based on your computer's hardware (MAC address, Hostname, and OS) before being written to your `config.yaml` file. 

If you move or copy your `config.yaml` file to a different computer (or change major hardware components), the API key will intentionally fail to decrypt to prevent unauthorized access. The application will not crash; you will simply need to re-enter your API key in the Settings menu on the new machine.

### Linux System Tray Menu Troubleshooting
On modern Linux/Ubuntu distributions using GNOME Shell (especially under Wayland), the system tray menu options may not display or respond to clicks if `pystray` falls back to the legacy `xlib` backend.

To resolve this, you need to ensure the AppIndicator libraries and PyGObject bindings are installed on your system and available to your Python environment:

1. **Install system-wide packages:**
   ```bash
   sudo apt update
   sudo apt install python3-gi gir1.2-appindicator3-0.1 libgirepository1.0-dev libcairo2-dev
   ```

2. **Install bindings in your Python environment:**
   If you are running WABS inside a virtual environment (`venv`), activate the venv and install `pygobject`:
   ```bash
   pip install pygobject
   ```
   *(Alternatively, you can recreate your virtual environment with the `--system-site-packages` flag so it inherits the system-wide `python3-gi` package: `python3 -m venv --system-site-packages venv`).*

### Limiting CPU Usage (Optional)
By default, the AI scanners (Face and Object detection) will try to use 100% of your available CPU cores to process files as fast as possible. If you want to run WABS in the background without it slowing down your PC or running your Raspberry Pi too hot, you can limit the number of CPU cores it uses by launching it from the terminal/command prompt with specific environment variables:

**On Windows (Command Prompt):**
```cmd
set MKL_NUM_THREADS=2
set OMP_NUM_THREADS=2
WABS-Windows.exe
```

**On Linux / Raspberry Pi:**
```bash
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 ./WABS-Linux
```

---

## Screenshot
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/fd5629fb-dbc3-40d1-b24a-8d7c6c66a336" />


## Advanced Users & Developers
* **Development & Build Instructions:** See `BUILD.md`
* **Architecture & Implementation:** See `ARCHITECTURE.md`

---
## Third-Party Licenses & Acknowledgments
* This project bundles the **MobileNetV2** model and **ImageNet** class list, exported from PyTorch/Torchvision. Torchvision is licensed under the BSD 3-Clause License. Copyright (c) Soumith Chintala 2016.
* Face Detection and Recognition models (**YuNet**, **SFace**) are provided by the OpenCV Zoo, licensed under the Apache 2.0 License.
* Offline Optical Character Recognition (OCR) is powered by **RapidOCR** (onnxruntime package) using the **PaddleOCR** models (`paddleOCR_det.onnx`, `paddleOCR_rec.onnx`, `paddleOCR_dict.txt`), licensed under the Apache 2.0 License.

---
**Developer:** Winny Mathew Kurian | **Email:** WiZarD.Devel@gmail.com | **License:** MIT
*This project was architected and prototyped with assistance from GenAI systems.*
