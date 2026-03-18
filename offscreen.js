// Offscreen document for DOCX generation
// This runs in a hidden document with DOM access
// Used by Chrome (offscreen API) and Firefox (popup window)

// Check if we're running as a Chrome offscreen document or Firefox window
const isChromeOffscreen = typeof chrome !== 'undefined' && chrome.runtime && !window.opener;

// Listen for messages from background script (Chrome)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'generateDOCX') {
      generateDOCX(message.data.templateBase64, message.data.replacements)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async
    }
  });
}

// For Firefox: Check if we have pending data to process
if (typeof browser !== 'undefined') {
  // Firefox mode - check for stored data
  browser.storage.local.get(['offscreenData']).then(data => {
    if (data.offscreenData) {
      const { templateBase64, replacements } = data.offscreenData;

      // Generate the DOCX
      generateDOCX(templateBase64, replacements)
        .then(result => {
          // Download the file
          const dataUrl = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + result;
          return browser.downloads.download({
            url: dataUrl,
            filename: `tailored_cv_${Date.now()}.docx`,
            saveAs: false
          });
        })
        .then(() => {
          // Clean up storage
          return browser.storage.local.remove(['offscreenData']);
        })
        .then(() => {
          // Close this window
          window.close();
        })
        .catch(error => {
          console.error('Error in offscreen generation:', error);
          browser.storage.local.set({
            analysisError: 'Failed to generate CV: ' + error.message
          });
          window.close();
        });
    }
  });
}

async function generateDOCX(base64Template, replacements) {
  const binaryString = atob(base64Template);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const zip = new PizZip(bytes.buffer);
  const doc = new Docxtemplater(zip, {
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
    console.error('Error rendering docx:', error);
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
 * Placeholders are in the format {PlaceholderName}
 * Returns an array of unique placeholder names (without braces)
 */
function extractPlaceholdersFromTemplate(zip) {
  const placeholders = new Set();

  try {
    // Get the document.xml content from the ZIP
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      console.warn('Could not find word/document.xml in template');
      return [];
    }

    const content = documentXml.asText();

    // Match all occurrences of {PlaceholderName}
    // This regex matches content between { and } that doesn't contain braces
    const regex = /\{([^}]+)\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const placeholder = match[1].trim();
      if (placeholder) {
        placeholders.add(placeholder);
      }
    }
  } catch (error) {
    console.error('Error extracting placeholders:', error);
  }

  return Array.from(placeholders);
}
