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
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const statusDiv = document.getElementById('status');
const fitnessBox = document.getElementById('fitness-box');
const fitnessScoreSpan = document.getElementById('fitness-score');
const fitnessAnalysisP = document.getElementById('fitness-analysis');
const progressSteps = document.getElementById('progress-steps');

// Handle reset button click
resetBtn.addEventListener('click', async () => {
  await browser.storage.local.remove([
    'analysisInProgress', 
    'analysisStep', 
    'analysisError', 
    'analysisResult', 
    'generatedDocx', 
    'generatedDocxName'
  ]);
  resetSteps();
  updateStatus('Ready to tailor your CV.', 'info');
  analyzeBtn.disabled = false;
  resetBtn.style.display = 'none';
  fitnessBox.style.display = 'none';
});

// Handle download button click
downloadBtn.addEventListener('click', async () => {
  const data = await browser.storage.local.get(['generatedDocx', 'generatedDocxName']);
  if (!data.generatedDocx) {
    updateStatus('No generated CV found. Try analyzing again.', 'error');
    return;
  }

  try {
    // Convert base64 to Blob
    const binaryString = atob(data.generatedDocx);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    // Create Object URL
    const url = URL.createObjectURL(blob);
    
    // Create hidden link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = data.generatedDocxName || `tailored_cv_${Date.now()}.docx`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    updateStatus('Download started!', 'success');
  } catch (err) {
    console.error('Download failed:', err);
    updateStatus('Download failed: ' + err.message, 'error');
  }
});

// Step definitions
const STEPS = {
  EXTRACT: 'extract',
  ANALYZE: 'analyze',
  GENERATE: 'generate',
  COMPLETE: 'complete'
};

// Restore state on popup open
document.addEventListener('DOMContentLoaded', restoreState);

async function restoreState() {
  const data = await browser.storage.local.get([
    'analysisResult',
    'analysisInProgress',
    'analysisError',
    'analysisStep'
  ]);

  if (data.analysisResult) {
    // Show previous results
    fitnessScoreSpan.textContent = data.analysisResult.fitness_score;
    fitnessAnalysisP.textContent = data.analysisResult.analysis;
    fitnessBox.style.display = 'block';
    updateStatus('CV generated! Download below.', 'success');
    updateStep(STEPS.COMPLETE);
    resetBtn.style.display = 'block'; // Allow reset
  } else if (data.analysisInProgress) {
    // Analysis is running in background
    updateStatus('Analysis in progress... check back shortly.', 'info');
    analyzeBtn.disabled = true;
    resetBtn.style.display = 'block'; // Allow emergency reset
    // Restore the current step if available
    if (data.analysisStep) {
      updateStep(data.analysisStep);
    }
    pollForResults();
  } else if (data.analysisError) {
    updateStatus(data.analysisError, 'error');
    analyzeBtn.disabled = false;
    resetBtn.style.display = 'block';
  } else {
    resetBtn.style.display = 'none';
    resetSteps();
  }
}

async function pollForResults() {
  // Poll storage for results
  const checkInterval = setInterval(async () => {
    const data = await browser.storage.local.get([
      'analysisResult',
      'analysisInProgress',
      'analysisError',
      'analysisStep'
    ]);

    if (data.analysisResult) {
      clearInterval(checkInterval);
      fitnessScoreSpan.textContent = data.analysisResult.fitness_score;
      fitnessAnalysisP.textContent = data.analysisResult.analysis;
      fitnessBox.style.display = 'block';
      updateStatus('CV generated! Download below.', 'success');
      updateStep(STEPS.COMPLETE);
      analyzeBtn.disabled = false;
      resetBtn.style.display = 'block';
    } else if (data.analysisError) {
      clearInterval(checkInterval);
      updateStatus(data.analysisError, 'error');
      analyzeBtn.disabled = false;
      resetBtn.style.display = 'block';
    } else if (!data.analysisInProgress) {
      clearInterval(checkInterval);
      updateStatus('Ready to tailor your CV.', 'info');
      analyzeBtn.disabled = false;
      resetBtn.style.display = 'none';
      resetSteps();
    } else if (data.analysisStep) {
      updateStep(data.analysisStep);
    }
  }, 1000);

  setTimeout(() => clearInterval(checkInterval), 120000);
}

// Progress Steps Functions
function resetSteps() {
  const steps = progressSteps.querySelectorAll('.step');
  steps.forEach(step => {
    step.className = 'step pending';
    const circle = step.querySelector('.step-circle');
    const stepName = step.dataset.step;
    // Reset circle content to number
    circle.textContent = getStepNumber(stepName);
  });
}

function getStepNumber(stepName) {
  const stepOrder = [STEPS.EXTRACT, STEPS.ANALYZE, STEPS.GENERATE, STEPS.COMPLETE];
  return stepOrder.indexOf(stepName) + 1;
}

function updateStep(currentStep) {
  const stepOrder = [STEPS.EXTRACT, STEPS.ANALYZE, STEPS.GENERATE, STEPS.COMPLETE];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex === -1) return;

  const steps = progressSteps.querySelectorAll('.step');

  steps.forEach((step, index) => {
    const stepName = step.dataset.step;
    const circle = step.querySelector('.step-circle');

    // Remove all state classes
    step.classList.remove('pending', 'active', 'completed');

    if (index < currentIndex) {
      // Completed step
      step.classList.add('completed');
      circle.innerHTML = '<span class="checkmark"></span>';
    } else if (index === currentIndex) {
      // Active step
      step.classList.add('active');
      circle.textContent = getStepNumber(stepName);
    } else {
      // Pending step
      step.classList.add('pending');
      circle.textContent = getStepNumber(stepName);
    }
  });

  // Save current step to storage
  browser.storage.local.set({ analysisStep: currentStep });
}

analyzeBtn.addEventListener('click', async () => {
  try {
    const data = await browser.storage.local.get(['apiKey', 'history', 'templateBase64', 'aiModel']);
    if (!data.apiKey || !data.history || !data.templateBase64) {
      throw new Error('Please configure settings (API Key, History, and Template) first.');
    }

    analyzeBtn.disabled = true;
    fitnessBox.style.display = 'none';

    // Step 1: Extract
    updateStep(STEPS.EXTRACT);
    updateStatus('Extracting job description...', 'info');

    // Extract job description from active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });
    const jobDescription = results[0].result;

    // Mark analysis as in progress
    await browser.storage.local.set({
      analysisInProgress: true,
      analysisTabUrl: tab.url,
      analysisStep: STEPS.ANALYZE
    });
    await browser.storage.local.remove(['analysisResult', 'analysisError', 'generatedDocx', 'generatedDocxName']);

    // Send message to background script to handle the long-running task
    await browser.runtime.sendMessage({
      action: 'startAnalysis',
      data: {
        apiKey: data.apiKey,
        history: data.history,
        templateBase64: data.templateBase64,
        aiModel: data.aiModel,
        jobDescription: jobDescription,
        tabUrl: tab.url
      }
    });

    // Update UI to show it's running in background
    updateStep(STEPS.ANALYZE);
    updateStatus('Analysis running in background... you can close this popup.', 'info');

    // Start polling for results
    pollForResults();

  } catch (err) {
    updateStatus(err.message, 'error');
    console.error(err);
    await browser.storage.local.set({ analysisError: err.message });
    await browser.storage.local.remove(['analysisInProgress', 'analysisStep']);
    analyzeBtn.disabled = false;
  }
});

function updateStatus(msg, type) {
  statusDiv.textContent = msg;
  statusDiv.className = 'status ' + (type || '');
}
