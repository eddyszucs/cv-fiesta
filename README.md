# CV Tailor AI

<div align="center">

<h3>Tailor your CV to any job description with AI — directly in your browser</h3>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#privacy">Privacy</a>
</p>

</div>

---

## Features

<table>
<tr>
<td>

### 🤖 AI-Powered
Intelligently analyzes job descriptions and matches them with your experience using advanced AI models via OpenRouter.

</td>
<td>

### 🎯 ATS-Optimized
Identifies key skills and requirements from job postings to ensure your CV passes Applicant Tracking Systems.

</td>
</tr>
<tr>
<td>

### 🔒 Privacy-First
Your data stays in your browser. API keys and career history are stored locally — never on our servers.

</td>
<td>

### 📄 DOCX Templates
Works with your existing CV templates. Just use `{Placeholder}` syntax for dynamic content.

</td>
</tr>
</table>

---

## Installation

### Firefox

1. Visit the [Firefox Add-ons Store](https://addons.mozilla.org) (link coming soon)
2. Click **"Add to Firefox"**
3. Grant permissions when prompted

### Chrome

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link coming soon)
2. Click **"Add to Chrome"**
3. Confirm the installation

### Development Mode

To load the extension in development mode:

**Firefox:**
1. Open Firefox and go to `about:debugging`
2. Click **"This Firefox"**
3. Click **"Load Temporary Add-on..."**
4. Select the `manifest.json` file

**Chrome:**
1. Open Chrome and go to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the extension folder

---

## Quick Start

### 1. Configure Your Settings

Click the **"Settings"** button in the extension popup to open the Options page:

- **OpenRouter API Key**: Get yours at [openrouter.ai](https://openrouter.ai)
- **AI Model**: Choose your preferred model (default: `openrouter/hunter-alpha`)
- **Career History**: Paste your full work experience, skills, and achievements
- **CV Template**: Upload a `.docx` file with `{Placeholder}` tags

### 2. Navigate to a Job Posting

Go to any job listing on LinkedIn, Indeed, or any other job board.

### 3. Click "Analyze & Tailor CV"

The extension will:
1. **Extract** the job description from the page
2. **Analyze** your fit and identify key requirements
3. **Generate** a tailored CV using AI
4. **Download** the completed DOCX file

---

## Template Placeholders

Your DOCX template should use `{Placeholder}` syntax. The AI will automatically fill these sections:

| Placeholder | Description |
|-------------|-------------|
| `{Summary}` | Professional summary tailored to the job |
| `{Skills}` | Relevant skills extracted from the job description |
| `{Experience1}` | First/most relevant work experience entry |
| `{Experience2}` | Second work experience entry |
| `{Experience3}` | Third work experience entry |

### Custom Placeholders

You can add any custom placeholders to your template (e.g., `{Education}`, `{Certifications}`, `{Languages}`). The AI will fill them when relevant.

### Template Example

```
{Summary}

SKILLS
{Skills}

EXPERIENCE
{Experience1}

{Experience2}

{Experience3}
```

---

## Screenshots

<div align="center">

*<! -- Screenshots to be added -- >*

| Popup Interface | Options Page | Progress Tracking |
|-----------------|--------------|-------------------|
| *(Coming soon)* | *(Coming soon)* | *(Coming soon)* |

</div>

---

## Privacy Policy

CV Tailor AI is designed with privacy as a core principle:

- 🔐 **Local Storage**: Your API key and career history are stored only in your browser's local storage
- 🚫 **No Data Collection**: We don't collect, transmit, or store your personal data on any servers
- 🌐 **Direct API Calls**: All AI requests go directly from your browser to OpenRouter
- 🗑️ **No Persistence**: Job descriptions are processed in memory and never saved

**Note**: When using the AI feature, your career history and the job description are sent to OpenRouter's API. Please review [OpenRouter's Privacy Policy](https://openrouter.ai/privacy) for details on their data handling.

---

## Supported Models

The extension works with any model available on OpenRouter:

| Model | Best For |
|-------|----------|
| `openrouter/hunter-alpha` | Balanced quality and speed (default) |
| `openai/gpt-4o` | High-quality output |
| `openai/gpt-4o-mini` | Fast, cost-effective generations |
| `anthropic/claude-3.5-sonnet` | Detailed, nuanced writing |

---

## Support & Feedback

- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/cv-tailor-ai/issues)
- 💡 **Feature Requests**: [Open an issue](https://github.com/yourusername/cv-tailor-ai/issues)
- 📧 **Contact**: your-email@example.com

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

**Made with ❤️ for job seekers worldwide**

</div>
