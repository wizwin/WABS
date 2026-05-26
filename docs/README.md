
# WABS (WiZarD's Archival and Backup Search)

> "How do I quickly find files, photos, videos, documents, installers, and backups spread across years of optical media and HDD archives?"

WABS is a modern, 100% offline archival management system designed to help you organize, search, and browse your digital backups. It provides a lightning-fast Explorer-style interface to manage hundreds of thousands of files across different drives.

## Features
* **Lightning-Fast Search:** Find files instantly by name, path, tags, or metadata using advanced operators (e.g., `size:>1GB`, `date:2020-2022`).
* **Smart Searches:** Save your most-used and complex search queries as one-click shortcuts.
* **Explorer-Style Browsing:** Navigate your archives with familiar grid and list views.
* **Rich Previews:** Auto-generates thumbnails for photos, videos, PDFs, and code.
* **Smart Categorization:** Automatically groups files into categories like Photos, Videos, Code, etc.
* **Offline Face Recognition:** Scans photos using local AI to find and group people automatically.
* **Object & Scene Tagging:** Classifies objects and scenes in photos completely offline, allowing you to easily search by content.
* **Portable:** Move your backup drives around? WABS easily remaps your indexed files to new drive letters.

## Getting Started

### 1. Download
Head over to the **Releases** page and download the latest standalone executable for your operating system.

### 2. Run
Place the downloaded file anywhere on your computer and double-click to run it. No installation required!
*(Note: On Linux, you may need to make the file executable first by running `chmod +x WABS-Linux` in your terminal)*

### 3. Access
Once the terminal window opens and the backend starts, open your web browser and navigate to:
`http://127.0.0.1:8000`

## How to Use
1. **Set Up Paths:** Go to **Settings** and specify your `Backup Path`, `Database Path`, and `Thumbnail Path`.
2. **Index Files:** Go to the **Dashboard** and click **Start** under Indexer Controls.
3. **Explore:** Use the **Explorer** and **Search** tabs to navigate and manage your data.

### Clearing AI Data Manually (Faces & Tags)
If you want to completely reset the AI's detected faces, people, and object tags, you can manually clear the AI database:
1. **Stop** the WABS application (close the terminal/command prompt window).
2. Open your file explorer and navigate to the folder you configured as your **Database Path** in WABS.
3. Locate and delete the `ai_metadata.db` file. *(Note: Do not delete your main `archive.db` file as that contains your core file index).*
4. **Restart** WABS. The application will automatically create a fresh, empty AI database on startup.
5. You can now go to the Dashboard and start the AI scanners to re-process your archive from scratch.

*(Note: You can also clear just the object tags directly from the UI by navigating to the **Tags** page and clicking **Clear All Object Tags**).*

### Exporting & Importing AI Data (JSON)
To safeguard your AI metadata against database wipes or migrations, you can export your data to portable JSON files:
1. Go to **Settings** and scroll down to the **Data Management** section.
2. Click **Export JSON** under **Known People (Faces)** or **Object & Custom Tags** to save your data.
3. To restore, simply click **Import JSON** and select your saved file. 
*Note: WABS uses a **Smart Path Fallback Matcher**, meaning your exported tags and faces will successfully import and remap to your files even if you have moved your archive to a completely different drive letter!*

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
* **Wildcards:** Use `*` for partial matches (e.g., `*vacation*`, `*.mp3`)

### Configuring Local AI (Free & Offline)
WABS supports using local LLMs (like LM Studio or Ollama) to automatically categorize unknown files securely on your own machine.
1. Go to **Settings** and check **Enable AI Classification**.
2. In the **AI Provider Base URL** field, enter your local runner's chat API endpoint:
   * *LM Studio:* `http://127.0.0.1:1234/v1/chat/completions`
   * *Ollama:* `http://127.0.0.1:11434/v1/chat/completions`
3. You can leave the **OpenAI API Key** field completely empty!

### Security Note: Hardware-Bound API Keys
WABS uses **Hardware-Bound Encryption** to protect your OpenAI API key from plain-text exposure. When you save your API key, it is encrypted using a unique fingerprint based on your computer's hardware (MAC address, Hostname, and OS) before being written to your `config.yaml` file. 

If you move or copy your `config.yaml` file to a different computer (or change major hardware components), the API key will intentionally fail to decrypt to prevent unauthorized access. The application will not crash; you will simply need to re-enter your API key in the Settings menu on the new machine.

---

## Screenshot
<img width="1891" height="1077" alt="image" src="https://github.com/user-attachments/assets/606a6834-c188-4fae-8d66-593dfb4737fd" />


## Advanced Users & Developers
* **Development & Build Instructions:** See `BUILD.md`
* **Architecture & Implementation:** See `ARCHITECTURE.md`

---
## Third-Party Licenses & Acknowledgments
* This project bundles the **MobileNetV2** model and **ImageNet** class list, exported from PyTorch/Torchvision. Torchvision is licensed under the BSD 3-Clause License. Copyright (c) Soumith Chintala 2016.
* Face Detection and Recognition models (**YuNet**, **SFace**) are provided by the OpenCV Zoo, licensed under the Apache 2.0 License.

---
**Developer:** Winny Mathew Kurian | **Email:** WiZarD.Devel@gmail.com | **License:** MIT
*This project was architected and prototyped with assistance from GenAI systems.*
