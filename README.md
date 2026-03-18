# CV Tailor AI - Firefox Extension

This directory contains the Firefox extension for tailoring your CV directly in the browser.

## Features
- **Browser-Based:** No CLI or Go installation required.
- **One-Click Analysis:** Automatically extracts job descriptions from the current tab.
- **ATS Optimized:** Tailors your CV with AI, including keywords and at least 3 experiences.
- **Secure:** Stores your API key and history locally in your browser.

## Installation (Development Mode)
1. Open Firefox and go to `about:debugging`.
2. Click on **"This Firefox"**.
3. Click **"Load Temporary Add-on..."**.
4. Select the `manifest.json` file in this directory.

## Usage
1. Open the extension popup by clicking its icon.
2. Click the **"Settings"** link in the top right. This will open the **Options Page** in a new tab.
3. In the Options Page:
   - Enter your **OpenRouter API Key**.
   - Paste your **Career History** into the text area.
   - Upload your **CV Template** (`.docx` file).
     - Use `{Placeholder}` style in your Word document (e.g., `{Summary}`, `{Skills}`, `{Experience1}`).
   - Click **Save Configuration**.
4. Close the Options tab.
5. Navigate to a job posting (e.g., on LinkedIn or Indeed).
6. Click **Analyze & Tailor CV** in the extension popup.
7. Wait for the AI to process; your tailored CV will download automatically.

## Placeholders
By default, the AI will try to fill the following placeholders:
- `{Summary}`
- `{Skills}`
- `{Experience1}`
- `{Experience2}`
- `{Experience3}`

You can add more placeholders to your template; the AI is instructed to identify and fill standard sections.
