# WABS Build & Developer Guide

This document outlines the development setup, local build processes, and GitHub release instructions for the WABS project.

---

## Developer Testing (Local Setup)

### Prerequisites
- **Node.js**: v16 or higher (for the frontend)
- **Python**: 3.10 or higher (for the backend)
- **Models**: 
  - [face_detection_yunet_2023mar.onnx](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet)
  - [face_recognition_sface_2021dec.onnx](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface)
  - [mobilenetv2-small.onnx](Extracted onnx)
  - [imagenet_classes.txt](https://github.com/pytorch/hub/blob/master/imagenet_classes.txt)

### 1. Backend Setup
Open your terminal in the root directory of the project (e.g., inside VSCode) and set up your Python environment.

```bash
# Create a virtual environment (recommended)
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install the required Python dependencies
pip install -r requirements.txt
```

Run the local backend API:
```bash
python -m uvicorn backend.app.main:app --reload
```

### 2. Frontend Setup
Navigate to the `frontend` directory and install the Node dependencies. 

*Note: The `@mui` packages provide the local SVG icons so the app functions entirely without an internet connection.*

```bash
cd frontend

# Install dependencies
npm install
npm install axios @mui/icons-material @mui/material @emotion/react @emotion/styled
```

Start the development server:
```bash
npm run dev
```
Now open your browser and navigate to the localhost URL provided by Vite to view your live changes!

---

## Building a Release (Local Windows / Linux / Raspberry Pi)

WABS is packaged into a single standalone executable using `PyInstaller`. You do not need to use VSCode to build the release; any standard terminal or command prompt will work.

### 1. Setup Python Environment
Open your terminal in the root directory of the project. Create a virtual environment and install the required Python dependencies:

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install the dependencies
pip install -r requirements.txt
```

### 2. Build the Frontend
Compile the React frontend into static, production-ready assets:
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2. Package with PyInstaller
Ensure your Python virtual environment is activated and `pyinstaller` is installed. Run the command applicable to your OS from the repository root:

**For Windows:**
```bash
pyinstaller --name WABS-Windows.exe --onefile --noconsole --add-data "frontend/dist;frontend/dist" --add-data "backend/*.onnx;backend" --add-data "backend/*.txt;backend" run.py
```

**For Linux:**
```bash
pyinstaller --name WABS-Linux --onefile --noconsole --add-data "frontend/dist:frontend/dist" --add-data "backend/*.onnx:backend" --add-data "backend/*.txt:backend" run.py
```
*(Note the separator difference: Windows uses `;` while Linux uses `:`)*

The final bundled executable will be generated inside the `dist/` folder.

---

## Publishing & Releasing to GitHub

### Publishing to a Repository
If you haven't yet pushed your project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/WABS.git
git push -u origin main
```

### Building a Release on GitHub (Automated)
WABS includes a GitHub Actions workflow (`build.yml`) that automatically generates executables.

**Option 1: Trigger via Release (Recommended)**
1. Go to your repository on GitHub.
2. Click on **Releases** > **Draft a new release**.
3. Create a new tag (e.g., `v1.0.0`) and enter a title/description.
4. Click **Publish release**.
5. The GitHub Action will run in the background. Once complete, it will automatically attach the compiled `WABS-Windows.exe`, `WABS-Linux`, and `WABS-RaspberryPi` binaries directly to the release page!

**Option 2: Manual Trigger**
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Build WABS Binaries** on the left.
3. Click **Run workflow** on the right.

### Posting or Updating the Final Executable Manually
If you need to manually upload or replace a binary:
1. Go to your repository's **Releases** page.
2. Find the target release and click the **Edit** button (pencil icon).
3. Scroll down to the **"Attach binaries by dropping them here or selecting them."** box.
4. Upload your locally compiled files from your `dist/` directory.
5. Click **Update release**.