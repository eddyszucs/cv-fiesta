const apiKeyInput = document.getElementById('api-key');
const modelInput = document.getElementById('ai-model');
const historyInput = document.getElementById('career-history');
const fileInput = document.getElementById('template-file');
const templateStatus = document.getElementById('template-status');
const saveBtn = document.getElementById('save-settings');
const statusDiv = document.getElementById('status');

// Load settings
browser.storage.local.get(['apiKey', 'aiModel', 'history', 'templateName']).then(data => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  modelInput.value = data.aiModel || 'openrouter/hunter-alpha';
  if (data.history) historyInput.value = data.history;
  if (data.templateName) templateStatus.textContent = `Loaded template: ${data.templateName}`;
});

saveBtn.addEventListener('click', async () => {
  const settings = {
    apiKey: apiKeyInput.value,
    aiModel: modelInput.value || 'openrouter/hunter-alpha',
    history: historyInput.value
  };

  const file = fileInput.files[0];
  if (file) {
    const base64 = await fileToBase64(file);
    settings.templateBase64 = base64;
    settings.templateName = file.name;
    templateStatus.textContent = `Saved template: ${file.name}`;
  }

  await browser.storage.local.set(settings);
  
  statusDiv.textContent = 'Settings saved successfully!';
  statusDiv.className = 'status success';
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
