
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
<img width="1895" height="892" alt="image" src="https://github.com/user-attachments/assets/80d4dde3-47e1-41c1-ba4c-475700327862" />

## Advanced Users & Developers
* **Development & Build Instructions:** See `BUILD.md`
* **Architecture & Implementation:** See `ARCHITECTURE.md`

---
**Developer:** Winny Mathew Kurian | **Email:** WiZarD.Devel@gmail.com | **License:** MIT
*This project was architected and prototyped with assistance from GenAI systems.*
