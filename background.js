// Background Script for CV Tailor AI
// Handles long-running tasks that must survive popup closure
// Cross-browser compatible (Chrome with offscreen, Firefox without)

console.log('[CV Tailor] Background script loaded');

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CV Tailor] Received message:', message.action);
  
  if (message.action === 'startAnalysis') {
    // Create a recurring alarm to keep the script waking up every minute
    browser.alarms.create('analysisKeepAlive', { periodInMinutes: 1 });

    // Respond immediately to the popup
    sendResponse({ success: true, message: 'Analysis started in background' });
    
    // Kick off the analysis
    performAnalysis(message.data)
      .catch(err => {
        console.error('[CV Tailor] Fatal error in performAnalysis:', err);
      })
      .finally(() => {
        browser.alarms.clear('analysisKeepAlive');
        console.log('[CV Tailor] Analysis lifecycle ended, keep-alive cleared');
      });
    
    return false;
  }
  
  return true;
});

// Listener for the keep-alive alarm
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'analysisKeepAlive') {
    console.log('[CV Tailor] Keep-alive alarm heartbeat at:', new Date().toLocaleTimeString());
    // Simple activity to tell the browser we are still here
    browser.storage.local.get(['analysisInProgress']).then(data => {
      if (!data.analysisInProgress) {
        browser.alarms.clear('analysisKeepAlive');
      }
    });
  }
});

async function performAnalysis({ apiKey, history, templateBase64, aiModel, jobDescription, tabUrl }) {
  const model = aiModel || 'openrouter/hunter-alpha';
  console.log('[CV Tailor] Starting analysis process...');
  
  // Heartbeat: periodically update storage to prevent suspension
  const heartbeat = setInterval(async () => {
    try {
      await browser.storage.local.set({ lastHeartbeat: Date.now() });
      // Also try to ping the popup if it's open
      await browser.runtime.sendMessage({ action: 'heartbeat' }).catch(() => {});
      console.log('[CV Tailor] Heartbeat sent...');
    } catch (e) {
      // Ignore errors (like popup being closed)
    }
  }, 10000); // Every 10 seconds

  try {
    // Step 1: Extract
    console.log('[CV Tailor] Step 1: Extract');
    await updateStep('extract');

    // Step 2: Analyze - Call AI
    console.log('[CV Tailor] Step 2: Calling AI...');
    await updateStep('analyze');
    const aiResponse = await callAI(apiKey, history, jobDescription, model);
    console.log('[CV Tailor] AI response received and parsed successfully');

    // Step 3: Generate - Create DOCX
    console.log('[CV Tailor] Step 3: Generating DOCX...');
    await updateStep('generate');
    
    // For Firefox: Background pages HAVE DOMParser/atob, so we can generate directly!
    console.log('[CV Tailor] Using Firefox Direct Background Generation');
    try {
      const result = await generateDOCXDirectly(templateBase64, aiResponse.replacements);
      console.log('[CV Tailor] DOCX generated successfully (direct). Size:', result.length);
      
      // Save the generated DOCX to storage
      await browser.storage.local.set({ 
        generatedDocx: result,
        generatedDocxName: `tailored_cv_${Date.now()}.docx`
      });
      console.log('[CV Tailor] DOCX saved to local storage');
    } catch (err) {
      console.error('[CV Tailor] Direct DOCX generation failed:', err);
      throw err;
    }

    // Step 4: Complete
    console.log('[CV Tailor] Step 4: Complete');
    await updateStep('complete');

    // Save results
    await browser.storage.local.set({
      analysisResult: {
        fitness_score: aiResponse.fitness_score,
        analysis: aiResponse.analysis
      }
    });
    await browser.storage.local.remove(['analysisInProgress', 'analysisTabUrl', 'analysisStep']);
    console.log('[CV Tailor] Analysis complete, results saved');

  } catch (err) {
    console.error('[CV Tailor] Background analysis error:', err);
    await browser.storage.local.set({ analysisError: err.message });
    await browser.storage.local.remove(['analysisInProgress', 'analysisStep']);
  } finally {
    clearInterval(heartbeat);
  }
}

async function updateStep(step) {
  await browser.storage.local.set({ analysisStep: step });
}

async function callAI(apiKey, history, jobDesc, model) {
  console.log('[CV Tailor] Calling OpenRouter API with model:', model);
  const prompt = `
You are an expert career coach and CV writer specializing in ATS (Applicant Tracking System) optimization.
I have a database of my past experiences and a target job description.

Your goal is to:
1. Analyze how well I fit the job (0-100 score).
2. Explain the fit briefly.
3. Generate content for a CV template to tailor it specifically for this job.

CRITICAL CONSTRAINTS:
- **Include All Experiences:** You MUST include at least the 4 most recent/relevant experiences from my history.
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
    "JobTitle": "<text>",
    "Summary": "<text>",
    "Skills": "<text>",
    "Experience1": "<text>",
    "Experience2": "<text>",
    "Experience3": "<text>",
    "Experience4": "<text>"
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
  console.log('[CV Tailor] API response status:', response.status);

  if (body.error) {
    console.error('[CV Tailor] API error:', body.error);
    throw new Error(body.error.message);
  }

  let content = body.choices[0].message.content;
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();

  console.log('[CV Tailor] AI content parsed successfully');
  return JSON.parse(content);
}

async function generateDOCX(templateBase64, replacements) {
  console.log('[CV Tailor] Starting DOCX generation phase');
  // Check if we're in Chrome (has offscreen API) or Firefox
  const isChrome = typeof chrome !== 'undefined' && chrome.offscreen;
  console.log('[CV Tailor] Browser detected:', isChrome ? 'Chrome' : 'Firefox');

  if (isChrome) {
    // Use offscreen document for Chrome (Service Workers don't have DOMParser)
    console.log('[CV Tailor] Using Chrome Offscreen API');
    await generateDOCXWithOffscreen(templateBase64, replacements);
  } else {
    // For Firefox: Background pages HAVE DOMParser/atob, so we can generate directly!
    console.log('[CV Tailor] Using Firefox Direct Background Generation');
    try {
      const result = await generateDOCXDirectly(templateBase64, replacements);
      console.log('[CV Tailor] DOCX generated successfully (direct). Size:', result.length);
      
      // Save the generated DOCX to storage so the popup can download it
      await browser.storage.local.set({ 
        generatedDocx: result,
        generatedDocxName: `tailored_cv_${Date.now()}.docx`
      });
      console.log('[CV Tailor] DOCX saved to local storage');
    } catch (err) {
      console.error('[CV Tailor] Direct DOCX generation failed:', err);
      throw err;
    }
  }
}

async function generateDOCXDirectly(base64Template, replacements) {
  console.log('[CV Tailor] Checking library availability...');
  const PizZipLib = window.PizZip;
  const DocxtemplaterLib = window.docxtemplater;

  if (!PizZipLib) {
    console.error('[CV Tailor] PizZip library not found in window object');
    throw new Error('PizZip library not loaded correctly.');
  }
  if (!DocxtemplaterLib) {
    console.error('[CV Tailor] docxtemplater library not found in window object');
    throw new Error('docxtemplater library not loaded correctly.');
  }

  console.log('[CV Tailor] Processing base64 template');
  const binaryString = atob(base64Template);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = new PizZipLib(bytes.buffer);
  const doc = new DocxtemplaterLib(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Extract all placeholders from the template and clean up unused ones
  const allPlaceholders = extractPlaceholdersFromTemplate(zip);
  const aiPlaceholders = Object.keys(replacements);
  const unused = allPlaceholders.filter(p => !aiPlaceholders.includes(p));

  // Set unused placeholders to empty string so they don't appear in output
  unused.forEach(p => {
    replacements[p] = '';
  });

  doc.setData(replacements);

  try {
    doc.render();
  } catch (error) {
    console.error('[CV Tailor] Error rendering docx:', error);
    throw new Error('Failed to render document placeholders.');
  }

  const out = doc.getZip().generate({
    type: 'base64',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return out;
}

/**
 * Extract all placeholders from the DOCX template
 */
function extractPlaceholdersFromTemplate(zip) {
  const placeholders = new Set();
  try {
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      console.warn('[CV Tailor] Could not find word/document.xml in template');
      return [];
    }
    const content = documentXml.asText();
    const regex = /\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const placeholder = match[1].trim();
      if (placeholder) {
        placeholders.add(placeholder);
      }
    }
  } catch (error) {
    console.error('[CV Tailor] Error extracting placeholders:', error);
  }
  return Array.from(placeholders);
}

async function generateDOCXWithOffscreen(templateBase64, replacements) {
  // Create offscreen document if it doesn't exist
  await createOffscreenDocument();

  // Send message to offscreen document to generate DOCX
  const response = await chrome.runtime.sendMessage({
    action: 'generateDOCX',
    data: {
      templateBase64: templateBase64,
      replacements: replacements
    }
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to generate DOCX');
  }

  // Download the generated file
  const dataUrl = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + response.data;

  await browser.downloads.download({
    url: dataUrl,
    filename: `tailored_cv_${Date.now()}.docx`,
    saveAs: false
  });

  // Close offscreen document to free resources
  await closeOffscreenDocument();
}

async function createOffscreenDocument() {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return; // Not Chrome, skip
  }

  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return; // Already exists
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Generate DOCX files using docxtemplater library which requires DOM APIs'
  });
}

async function closeOffscreenDocument() {
  if (typeof chrome === 'undefined' || !chrome.offscreen) {
    return; // Not Chrome, skip
  }

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}
