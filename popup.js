// Navigation
document.getElementById('open-settings').addEventListener('click', () => {
  if (browser.runtime.openOptionsPage) {
    browser.runtime.openOptionsPage();
  } else {
    window.open(browser.runtime.getURL('options.html'));
  }
});

// Main Action Elements
const analyzeBtn = document.getElementById('analyze-btn');
const statusDiv = document.getElementById('status');
const fitnessBox = document.getElementById('fitness-box');
const fitnessScoreSpan = document.getElementById('fitness-score');
const fitnessAnalysisP = document.getElementById('fitness-analysis');

// Restore state on popup open
document.addEventListener('DOMContentLoaded', restoreState);

async function restoreState() {
  const data = await browser.storage.local.get(['analysisResult', 'analysisInProgress', 'analysisError']);
  
  if (data.analysisResult) {
    // Show previous results
    fitnessScoreSpan.textContent = data.analysisResult.fitness_score;
    fitnessAnalysisP.textContent = data.analysisResult.analysis;
    fitnessBox.style.display = 'block';
    updateStatus('CV generated and downloaded!', 'success');
  } else if (data.analysisInProgress) {
    // Analysis is running in background
    updateStatus('Analysis in progress... check back shortly.', 'info');
    analyzeBtn.disabled = true;
    pollForResults();
  } else if (data.analysisError) {
    updateStatus(data.analysisError, 'error');
    await browser.storage.local.remove('analysisError');
  }
}

async function pollForResults() {
  // Poll storage for results
  const checkInterval = setInterval(async () => {
    const data = await browser.storage.local.get(['analysisResult', 'analysisInProgress', 'analysisError']);
    
    if (data.analysisResult) {
      clearInterval(checkInterval);
      fitnessScoreSpan.textContent = data.analysisResult.fitness_score;
      fitnessAnalysisP.textContent = data.analysisResult.analysis;
      fitnessBox.style.display = 'block';
      updateStatus('CV generated and downloaded!', 'success');
      analyzeBtn.disabled = false;
    } else if (data.analysisError) {
      clearInterval(checkInterval);
      updateStatus(data.analysisError, 'error');
      analyzeBtn.disabled = false;
      await browser.storage.local.remove('analysisError');
    } else if (!data.analysisInProgress) {
      // Analysis was cleared without result (shouldn\'t happen, but handle it)
      clearInterval(checkInterval);
      updateStatus('Ready to tailor your CV.', 'info');
      analyzeBtn.disabled = false;
    }
  }, 1000);
  
  // Stop polling after 2 minutes
  setTimeout(() => clearInterval(checkInterval), 120000);
}

analyzeBtn.addEventListener('click', async () => {
  try {
    const data = await browser.storage.local.get(['apiKey', 'history', 'templateBase64', 'aiModel']);
    if (!data.apiKey || !data.history || !data.templateBase64) {
      throw new Error('Please configure settings (API Key, History, and Template) first.');
    }

    const model = data.aiModel || 'openrouter/hunter-alpha';

    analyzeBtn.disabled = true;
    fitnessBox.style.display = 'none';
    updateStatus('Extracting job description...', 'info');

    // 1. Extract job description
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });
    const jobDescription = results[0].result;

    updateStatus('Calling AI for analysis...', 'info');
    
    // Mark analysis as in progress
    await browser.storage.local.set({ 
      analysisInProgress: true,
      analysisTabUrl: tab.url 
    });
    await browser.storage.local.remove(['analysisResult', 'analysisError']);

    // 2. AI Call
    const aiResponse = await callAI(data.apiKey, data.history, jobDescription, model);
    
    fitnessScoreSpan.textContent = aiResponse.fitness_score;
    fitnessAnalysisP.textContent = aiResponse.analysis;
    fitnessBox.style.display = 'block';

    updateStatus('Generating tailored CV...', 'info');

    // 3. Generate DOCX
    await generateDOCX(data.templateBase64, aiResponse.replacements);

    // Save results to storage so they persist after popup closes
    await browser.storage.local.set({ 
      analysisResult: {
        fitness_score: aiResponse.fitness_score,
        analysis: aiResponse.analysis
      }
    });
    await browser.storage.local.remove(['analysisInProgress', 'analysisTabUrl']);

    updateStatus('CV generated and downloaded!', 'success');
  } catch (err) {
    updateStatus(err.message, 'error');
    console.error(err);
    // Save error so it can be shown if popup was closed
    await browser.storage.local.set({ analysisError: err.message });
    await browser.storage.local.remove('analysisInProgress');
  } finally {
    analyzeBtn.disabled = false;
  }
});

function updateStatus(msg, type) {
  statusDiv.textContent = msg;
  statusDiv.className = 'status ' + (type || '');
}

async function callAI(apiKey, history, jobDesc, model) {
  const prompt = `
You are an expert career coach and CV writer specializing in ATS (Applicant Tracking System) optimization.
I have a database of my past experiences and a target job description.

Your goal is to:
1. Analyze how well I fit the job (0-100 score).
2. Explain the fit briefly.
3. Generate content for a CV template to tailor it specifically for this job.

CRITICAL CONSTRAINTS:
- **Include All Experiences:** You MUST include at least the 3 most recent/relevant experiences from my history.
- **ATS Optimization:** Integrate keywords from the job description naturally.
- **Impact-Oriented:** Use action verbs and quantify achievements.

My History:
${history}

Target Job:
${jobDesc}

Output Format:
Return ONLY a valid JSON object with this structure:
{
  "fitness_score": <int>,
  "analysis": "<string>",
  "replacements": {
    "Summary": "<text>",
    "Skills": "<text>",
    "Experience1": "<text>",
    "Experience2": "<text>",
    "Experience3": "<text>"
  }
}
`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/cv-analyzer-extension',
      'X-Title': 'CV Tailor Extension'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const body = await response.json();
  if (body.error) throw new Error(body.error.message);

  let content = body.choices[0].message.content;
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();

  return JSON.parse(content);
}

async function generateDOCX(base64Template, replacements) {
  if (typeof window.PizZip === 'undefined') {
    throw new Error('PizZip library not loaded. Please reload the extension.');
  }
  const Docxtemplater = window.docxtemplater || window.Docxtemplater;
  if (typeof Docxtemplater === 'undefined') {
    throw new Error('docxtemplater library not loaded. Please reload the extension.');
  }

  const binaryString = window.atob(base64Template);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = new window.PizZip(bytes.buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.setData(replacements);

  try {
    doc.render();
  } catch (error) {
    console.error('Error rendering docx:', error);
    throw new Error('Failed to render document placeholders.');
  }

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const url = URL.createObjectURL(out);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tailored_cv_${Date.now()}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
