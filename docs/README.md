
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
* **People Categorization & Relationship Tree:** Organize named profiles into Family, Friends, and Other categories with custom relationship labels. View an interactive, collapsible relationship tree anchored to your profile ("Me") to search and browse photos of relatives and friends faster. *(Note: This feature is designed to enrich media search and browsing, not serve as a full genealogy manager).*
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

### Settings Reference

The Settings page is divided into six tabs to let you customize WABS's database path, backups, UI preferences, AI parameters, Smart Searches, and clean up or backup your data:

#### 1. General (System Settings)
* **Who Am I? (WABS User Identity)**: Select your own profile from your named people list. WABS uses this identity to anchor your relationship tree ("Me") and establish relationships relative to you.
* **System Paths**:
  * **Database Path**: The folder where the SQLite databases (`archive.db`, `ai_metadata.db`, and `relationships.db`) are saved.
  * **Thumbnail Path**: The folder where generated preview thumbnails and cropped face images are cached.
  * **Global Excluded Folders**: A comma-separated list of folder names that WABS will skip in all directories (e.g. `node_modules, .git, venv, bin`).
* **Data Safety**:
  * **Enable Global Read-Only Mode**: Disables all physical move, delete, and rename actions in the UI, overriding individual backup settings to protect your data.
  * **Allow deleting unverified duplicates (Dangerous)**: Toggles whether you can delete duplicate files before they have been verified with a full SHA-256 hash match.
* **Startup**:
  * **Start WABS automatically on user login**: Configures WABS to run in the background automatically upon logging into your computer.
* **Memory Management**:
  * **Automatically release memory when idle**: Unloads heavy Python libraries and ONNX AI models when WABS is inactive for a chosen duration (reclaiming ~500MB+ RAM). The idle timeout can be configured from 5 minutes to 2 hours.
* **Diagnostics**:
  * **Enable Background Logging**: Writes execution logs to `wabs.log` to help debug issues.

#### 2. Backups (Storage & Backup Locations)
Configure the physical drives, discs, or folder trees that you want to index.
* **Add / Remove Location**: Manage multiple storage roots.
* **Backup Path (Indexed Location)**: The source folder tree to index.
* **Enable path remapping**: If you move your archive or run it on a new computer where the drive letter/mount point changes, enable this and select the **Mapped Backup Path (New Location)**. WABS will automatically map your indexed records without needing a full re-scan.
* **Read-Only Mode**: Restrict files in this specific location from being moved or deleted.
* **Excluded Folders**: Specify folder names to exclude *only* for this specific backup location.

#### 3. UI Preferences
* **Theme**: Choose between **Dark Mode** and **Light Mode**.
* **View Preferences**:
  * Toggle the visibility of the **Sidebar**, **Timeline**, and **Details Panel**.
  * **Show Full Archive Timeline**: Toggles showing the calendar timeline of all indexed media.
  * **Enable UI Animations**: Turns interface animations on or off for smoother UI transitions.
  * **Enable Photo Thumbnail Caching**: Re-compresses and caches previews of large photos (above a configurable file size threshold, e.g. 5MB) to speed up loading grids.
  * **Load all files at once (High memory usage)**: Disables lazy loading, fetching the entire list of files immediately.
  * **Files to load per scroll**: Configures the pagination chunk size (default: 50) for lazy-rendered lists.

#### 4. AI & Vision
Configure AI models, scanner sensitivities, and offline OCR engines:
* **AI / LLM**:
  * **Enable AI Classification**: Enables natural language features. Set a custom **AI Provider Base URL** (e.g. `http://127.0.0.1:11434/v1` for Ollama or `http://127.0.0.1:1234/v1` for LM Studio) and **AI Model** name. You can enter an OpenAI key (encrypted securely) or leave it blank to run fully local.
  * **Test AI Connection**: Performs a test query to verify your LLM provider configuration.
* **Detection Sensitivity**:
  * **Face Detection**: Adjust face-finding sensitivity (`High`, `Medium`, `Low`).
  * **Face Clustering Strictness**: Controls how strictly faces are grouped into profiles (`Strict`, `Medium`, `Loose`).
  * **Minimum Photos for Unknown Persons**: Hides unknown face clusters that contain fewer than the specified number of photos.
  * **Object & Scene Detection**: Controls the confidence threshold for tagging objects (`High`, `Medium`, `Low`).
  * **Document Text Extraction Word Limit**: Limits the number of extracted words per file to keep the search index lightweight (max 10,000 words).
  * **Document Scanning Depth**: Set scanning depth (`Low`, `Medium`, `High`).
* **OCR (Optical Character Recognition)**:
  * **Enable OCR**: Extract printed English text from images and PDF pages.
  * **Only run OCR on photos without faces/objects**: Skip scenic or portrait photos to focus text extraction strictly on receipts, screenshots, and documents.
  * **OCR Maximum Pages per Document**: Limits the number of pages processed per PDF to speed up background runs.
* **Advanced Performance Tuning**:
  * **AI & Media CPU Threads**: Restrict the number of CPU cores used by face/object scanners (default: 4).
  * **OCR CPU Threads**: Restrict the number of CPU cores used by text extraction (default: 4).
  * **OCR Image Scan Limit**: Resizes large images during the text detection phase to speed up processing (default: 736px).
  * **OCR Downscaling Mode**: Choose how WABS resizes documents before detecting text (`Minimum Side`, `Maximum Side`).
* **Hidden People**:
  * Displays named or unknown profiles you chose to hide. You can unhide them with one click.

#### 5. Smart Searches
Manage and build saved searches:
* **Add Smart Search**: Create new saved shortcuts.
* **AI Search Assistant**: Use natural language prompts to generate search queries (requires LLM setup in AI tab).
* **Remove / Edit Query**: Update saved shortcuts and their underlying search operators.

#### 6. Data Management
* **Database Cleanup & Optimization**: Removes missing file indices from the database, deletes orphaned face crops/records and tag associations, purges empty person profiles and orphaned relationship links, and runs SQLite `VACUUM` across all databases to reclaim disk space.
* **Full Database Backup**: Creates a backup copy containing `archive.db`, `ai_metadata.db`, `relationships.db`, and `config.yaml`.
* **Data Portability (Import/Export JSON)**:
  * Export/import named people (faces), relationships & categories, custom tags, or virtual folders as portable, platform-independent JSON files.
  * **Combined WABS Backup**: Backup or restore all custom tags, face profiles, relationships, and virtual folders together in a single JSON file.
  * *Note: Imports utilize path remapping and soft-link resolution, meaning your relationships and tags restore seamlessly even if files or face clusters are moved or regenerated.*
* **Clear Thumbnail Cache**: Deletes all cached preview images to reclaim disk space (regenerates on demand).

---

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

### People Categorization & Relationship Tree

> [!NOTE]
> **Purpose**: WABS is an archival and media search tool, **not** a full genealogy manager or family tree builder. The relationship categorization system is designed to enrich media search (e.g. searching for "wife", "sister", "colleague") and give you a structured way to browse family and friends.

1. **Configuring "Who Am I?" Identity:**
   * Go to **Settings** ➔ **General** and choose your own profile from the **Who Am I?** dropdown.
   * WABS uses this identity to anchor your relationship tree (`"Me"`) and build relative branches for parents, spouse, children, siblings, and extended family.

2. **Categorizing Named People:**
   * Open any named person's photo collection from the **People** tab.
   * Use the **Relationship Bar** directly below the header to choose:
     * **Primary Category:** `Family`, `Friends`, or `Others`.
     * **Relationship Type / Subcategory:**
       * *Family:* Spouse / Partner, Parent, Child, Sibling, Grandparent, Grandchild, In-law (Father/Mother/Brother/Sister-in-law), Cousin (1st), Cousin (2nd), Aunt / Uncle, Niece / Nephew, Other Family.
       * *Friends:* Close Friend, Colleague / Work, Classmate / School, Acquaintance, Other Friend.
       * *Others:* Neighbor, Service Contact, Other.
     * **Custom Label:** Add a custom label (e.g. `"Wife"`, `"Sister"`, `"Acme Corp"`, `"College roommate"`).
   * **Explicit Confirmation:** Changes are staged locally; click the **✓ (Save)** button or press <kbd>Enter</kbd> to apply them, or click **✕ (Cancel)** or press <kbd>Escape</kbd> to discard changes.

3. **Filtering & Searching by Relationships:**
   * **Category Filter Pills:** Click the `All`, `Family`, `Friends`, `Others`, or `Uncategorized` filter pills on the People page to view matching profiles with live counts. Your active filter preference is saved automatically.
   * **Unified Search:** Typing kinship terms or custom labels (e.g. `wife`, `colleague`, `cousin`) into the search bar matches people instantly.

4. **Interactive Multi-Column Relationship Tree View:**
   * Switch to the dedicated **Tree View** tab on the People page to view your structured kinship hierarchy.
   * **Modular Side-by-Side Cards:** Family, Friends, and Others are organized in responsive side-by-side category cards, minimizing vertical scrolling.
   * **Search & Controls:** Real-time tree search box, person count badges, and one-click **Expand All** / **Collapse All** controls.
   * Clicking any person node opens their photo timeline immediately.

5. **Safe Sidecar Storage (`relationships.db`):**
   * All relationship assignments are saved in a separate sidecar database (`relationships.db`).
   * If you ever wipe or rescan `ai_metadata.db`, your entire relationship hierarchy is preserved and automatically relinked when faces are renamed.

### Relationship & Kinship Mapping Reference Guide

WABS uses anchor-relative kinship modeling anchored to **"Me"**. Use the following reference guide to quickly categorize your family, in-laws, friends, and contacts:

| Relative / Relation | Category | Type (Subcategory) | Suggested Custom Label | Tree Placement |
| :--- | :--- | :--- | :--- | :--- |
| **Spouse / Partner** | `Family` | `Spouse` | `"Wife"`, `"Husband"`, `"Partner"`, `"Fiancée"`, `"Fiancé"` | Family ➔ Spouse / Partner |
| **Parents** | `Family` | `Parent` | `"Mother"`, `"Father"`, `"Mom"`, `"Dad"`, `"Stepmother"`, `"Stepfather"` | Family ➔ Parents |
| **Children** | `Family` | `Child` | `"Son"`, `"Daughter"`, `"Eldest Son"`, `"Youngest Daughter"`, `"Stepson"` | Family ➔ Children |
| **Siblings** | `Family` | `Sibling` | `"Brother"`, `"Sister"`, `"Elder Brother"`, `"Younger Sister"` | Family ➔ Siblings |
| **Grandparents** | `Family` | `Grandparent` | `"Maternal Grandmother"`, `"Maternal Grandfather"`, `"Paternal Grandmother"`, `"Paternal Grandfather"` | Family ➔ Grandparents |
| **Grandchildren** | `Family` | `Grandchild` | `"Grandson"`, `"Granddaughter"`, `"Great-Grandson"`, `"Great-Granddaughter"` | Family ➔ Extended ➔ Other Family |
| **Great-Grandparents** | `Family` | `Great-Grandparent` | `"Maternal Great-Grandmother"`, `"Paternal Great-Grandfather"` | Family ➔ Extended ➔ Other Family |
| **Parents' Siblings (Aunts / Uncles)** | `Family` | `Aunt / Uncle` | `"Maternal Uncle (Mother's Brother)"`, `"Maternal Aunt"`, `"Paternal Uncle"`, `"Paternal Aunt"` | Family ➔ Extended ➔ Aunts & Uncles |
| **Grandparents' Siblings (Great-Aunts / Uncles)** | `Family` | `Great-Aunt / Uncle` | `"Maternal Great-Uncle (Grandpa's Brother)"`, `"Maternal Great-Aunt"`, `"Paternal Great-Uncle"` | Family ➔ Extended ➔ Great-Aunts & Uncles |
| **1st Cousins (Parents' Siblings' Children)** | `Family` | `Cousin (1st)` | `"Maternal 1st Cousin"`, `"Paternal 1st Cousin"`, `"Cousin Brother"`, `"Cousin Sister"` | Family ➔ Extended ➔ 1st Cousins |
| **1st Cousin's Spouse (Cousin-in-law)** | `Family` | `In-law` or `Cousin (1st)` | `"Cousin-in-law (1st Cousin's Wife / Husband)"`, `"Cousin's Wife"`, `"Cousin's Husband"` | Family ➔ Extended ➔ In-laws |
| **1st Cousin's Children (1C1R Downwards)** | `Family` | `Cousin (Once Removed)` | `"1st Cousin's Son (1C1R Downwards)"`, `"1st Cousin's Daughter"`, `"Cousin's Child"` | Family ➔ Extended ➔ Cousins Once Removed |
| **Parents' 1st Cousins (1C1R Upwards)** | `Family` | `Cousin (Once Removed)` | `"Mother's 1st Cousin (Maternal 1C1R)"`, `"Father's 1st Cousin (Paternal 1C1R)"` | Family ➔ Extended ➔ Cousins Once Removed |
| **2nd Cousins (Parents' 1st Cousins' Children)** | `Family` | `Cousin (2nd / Distant)` | `"Maternal 2nd Cousin (Mother's Cousin's Child)"`, `"Mother's 1st Cousin's Son"`, `"2nd Cousin"` | Family ➔ Extended ➔ 2nd / Distant Cousins |
| **Siblings' Children (Nieces / Nephews)** | `Family` | `Niece / Nephew` | `"Nephew (Brother's / Sister's Son)"`, `"Niece"`, `"Grandnephew"`, `"Grandniece"` | Family ➔ Extended ➔ Nieces & Nephews |
| **Spouse's Parents (In-laws)** | `Family` | `In-law` | `"Mother-in-law (Spouse's Mother)"`, `"Father-in-law (Spouse's Father)"` | Family ➔ Extended ➔ In-laws |
| **Spouse's Siblings (In-laws)** | `Family` | `In-law` | `"Brother-in-law (Spouse's Brother / Sister's Husband)"`, `"Sister-in-law"` | Family ➔ Extended ➔ In-laws |
| **Spouse's Siblings' Spouses (Co-In-laws)** | `Family` | `In-law` | `"Co-Brother (Spouse's Sister's Husband)"`, `"Co-Sister (Spouse's Brother's Wife)"` | Family ➔ Extended ➔ In-laws |
| **Children's Spouses (In-laws)** | `Family` | `In-law` | `"Son-in-law (Daughter's Husband)"`, `"Daughter-in-law (Son's Wife)"` | Family ➔ Extended ➔ In-laws |
| **Spouse's Extended Family (Uncles / Cousins)** | `Family` | `Spouse's Family` | `"Spouse's Maternal Uncle"`, `"Spouse's 1st Cousin"`, `"Spouse's Grandparents"`, `"Spouse's Niece"` | Family ➔ Extended ➔ In-laws |
| **Close Friends** | `Friends` | `Close Friend` | `"Best Friend"`, `"Childhood Friend"`, `"College Friend"`, `"School Friend"` | Friends ➔ Close Friends |
| **Colleagues / Work** | `Friends` | `Colleague` | `"Manager"`, `"Teammate"`, `"Co-worker"`, `"Mentor"`, `"Client"`, `"Business Partner"` | Friends ➔ Colleagues & Work |
| **Classmates / School** | `Friends` | `Classmate` | `"Schoolmate"`, `"College Roommate"`, `"Batchmate"`, `"Alumni"` | Friends ➔ Classmates / School |
| **Acquaintances** | `Friends` | `Acquaintance` | `"Acquaintance"`, `"Club Member"` | Friends ➔ Acquaintances |
| **Neighbors** | `Others` | `Neighbor` | `"Next-door Neighbor"`, `"Apartment Society"`, `"Community Member"` | Others ➔ Neighbors |
| **Service & Professional Contacts** | `Others` | `Service Contact` | `"Doctor"`, `"Teacher"`, `"Lawyer"`, `"Driver"`, `"Contractor"` | Others ➔ Service & Professional Contacts |

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

> [!TIP]
> **Virtual Folder Customization & Defaults**
> * **Default Styles:** By default, **Blue Folders** represent manual folders and **Purple Folders** represent smart folders with dynamic rules.
> * **Custom Styling:** You can fully customize any virtual folder by selecting from **10 modern colors** and **11 descriptive icons** (such as Photos, Music, Videos, Starred, Heart, Work, Home, etc.) in the Create/Edit dialog.

#### Subfolders & Nesting
Virtual Folders can be nested inside other Virtual Folders, creating a hierarchy. Opening a parent folder shows both its own files and any Virtual Folder subfolders it contains. You can navigate the tree just like a physical directory.

#### Selection Behavior
The selection system treats Virtual Folders consistently with physical folders:
* **Selecting a Virtual Folder** implicitly covers all its member files (manual + dynamic). A ✓ badge indicates full selection.
* **Partial selection** is shown with an indeterminate indicator when only some members are checked.
* **Deselecting** a child item removes it from the selection without affecting the rest of the parent's contents.
* Selection state is used by batch operations (export, tagging, deletion) — exactly the same as with physical folders.

#### Exporting Virtual Folder Contents
* **Data Portability (Metadata Export):** You can export virtual folder structures, configurations, colors, and rules as a portable JSON file from the Data Management section in Settings.
* **Direct Disk Export:** You can recursively copy all actual files within a virtual folder (and its nested subfolders) to a physical directory on another drive. Triggering this option opens a native OS-level folder selector to pick the destination path.

---

### Visual Indicators & Notations

To help you manage your archive at a glance, WABS uses specific icons, badges, and colors on file cards and lists:

#### 1. File Status Badges
* ⏳ **Processing (Hourglass Icon, Light Blue)**: The file is currently being analyzed by background scanners (extracting text, detecting faces, or identifying objects). The card will show a glowing blue border and blue background.
* ✅ **Verified Duplicate (Checkmark Icon, Green)**: Indicates a duplicate file where the SHA-256 hash has been calculated and verified to be a 100% match with another file in your database.
* ⏳ **Unverified Duplicate (Hourglass Icon, Orange/Amber)**: Indicates a potential duplicate file (matches in filename and file size), but the SHA-256 hash comparison is still pending.
* **RO / Read-Only Badge (Dark Gray)**: Displayed on files located within a read-only backup directory to indicate that they cannot be modified, moved, or deleted.

#### 2. Selection Indicators
* **Standard Checkbox (Blue/Default)**: Appears on hover or when a file is manually selected using the checkbox on its card.
* **Implicit Selection (Teal Highlight & Checkbox)**: When you select a parent folder (physical directory or virtual folder), all files inside it are automatically selected *implicitly*. These files are highlighted with a teal border and a teal checkbox. Hovering over the checkbox shows "Selected via parent folder". Clicking it allows you to manually override the selection.

#### 3. Media & Placeholder Styles
* 🎬 **Video Play Overlay**: Video files display a play button overlay on their thumbnails.
* 🎵 **Audio Album Art**: WABS automatically extracts and caches album/cover art from audio files (MP3, MP4/M4A, FLAC, OGG, and WMA) to display them as thumbnails.
* 🎵 **Indigo Audio Fallbacks**: Audio files without embedded album art show a custom indigo-themed placeholder (light indigo `#f5f3ff` in light theme, dark indigo `#1e1b4b` in dark theme) rather than a generic fallback.

---

### Smart Searches & AI Search Assistant

#### Smart Searches
You can save any complex search query (e.g., `type:video length:>1h size:>2GB`) as a **Smart Search** shortcut. Once saved, these shortcuts appear in the search panel so you can rerun them with a single click.

#### AI Search Assistant (Natural Language Search)
If you aren't sure how to write a search query using search operators, WABS can translate natural language requests (e.g., *"photos of dogs taken on a Nikon camera in 2023"*) into valid search syntax:
1. Ensure your local or cloud LLM provider (Ollama, LM Studio, or OpenAI) is configured in **Settings**.
2. Go to the **Search** page, find the **AI Search Assistant** section, and enter your request in plain English.
3. Click **Generate** — WABS will call your AI model to translate the request and automatically save it as a new **Smart Search** shortcut (e.g., `object:dog camera:nikon date:2023`).
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
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/416e5b66-0821-4099-bb76-df43259fb07c" />


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
