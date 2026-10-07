export function setupUI({ onStart }) {
  const loader = document.getElementById('loader');
  const loaderStatus = document.getElementById('loaderStatus');
  const tabs = [...document.querySelectorAll('.tab')];
  const panes = [...document.querySelectorAll('.pane')];
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('file');
  const picked = document.getElementById('picked');
  const pname = document.getElementById('pname');
  const psize = document.getElementById('psize');
  const px = document.getElementById('px');
  const urlInput = document.getElementById('url');
  const pasteBtn = document.getElementById('paste');
  const goBtn = document.getElementById('go');
  const statusPill = document.getElementById('statusPill');

  let selectedFile = null;

  const hideLoader = () => {
    if (loader) loader.classList.add('hide');
    if (loaderStatus) loaderStatus.textContent = 'Ready';
  };

  const refreshGoState = () => {
    const hasInput = !!selectedFile || !!urlInput.value.trim();
    goBtn.disabled = !hasInput;
  };

  const setFileSelection = (file) => {
    selectedFile = file || null;
    if (!file) {
      picked.classList.remove('show');
      pname.textContent = '';
      psize.textContent = '';
      fileInput.value = '';
      refreshGoState();
      return;
    }

    const size = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    pname.textContent = file.name;
    psize.textContent = size;
    picked.classList.add('show');
    refreshGoState();
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const index = Number(tab.dataset.i);
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panes.forEach((pane) => pane.classList.toggle('active', Number(pane.id.replace('pane-', '')) === index));
      if (statusPill) statusPill.textContent = index === 0 ? 'UPLOAD' : 'URL';
    });
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.add('drag');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.remove('drag');
    });
  });

  drop.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      setFileSelection(file);
      const urlTab = document.getElementById('pane-1');
      urlTab.classList.remove('active');
      document.getElementById('pane-0').classList.add('active');
      tabs[0].classList.add('active');
      tabs[1].classList.remove('active');
    }
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0] || null;
    setFileSelection(file);
  });

  px.addEventListener('click', () => {
    setFileSelection(null);
  });

  urlInput.addEventListener('input', refreshGoState);

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text.trim();
      refreshGoState();
    } catch {
      urlInput.focus();
    }
  });

  goBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    onStart({ file: selectedFile, url });
    goBtn.disabled = true;
    goBtn.classList.add('loading');
  });

  setTimeout(hideLoader, 700);
  refreshGoState();

  return {
    getSelectedFile: () => selectedFile,
    setSelectedFile
  };
}
