// popup.js - SIGED Desarrollo del Curso
// Smart page detection + CSV loading + execution control

let parsedData = [];
let isRunning = false;

// === DOM REFS ===
const statusBanner = document.getElementById('statusBanner');
const statusText = document.getElementById('statusText');
const statusDetail = document.getElementById('statusDetail');
const panelNotSiged = document.getElementById('panelNotSiged');
const panelWrongSection = document.getElementById('panelWrongSection');
const panelReady = document.getElementById('panelReady');
const csvFile = document.getElementById('csvFile');
const uploadArea = document.getElementById('uploadArea');
const uploadIcon = document.getElementById('uploadIcon');
const uploadText = document.getElementById('uploadText');
const fileSummary = document.getElementById('fileSummary');
const fileSummaryText = document.getElementById('fileSummaryText');
const previewSection = document.getElementById('previewSection');
const previewBody = document.getElementById('previewBody');
const formatHelp = document.getElementById('formatHelp');
const cardConfig = document.getElementById('cardConfig');
const cardRun = document.getElementById('cardRun');
const btnRun = document.getElementById('btnRun');
const btnStop = document.getElementById('btnStop');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const progressCount = document.getElementById('progressCount');
const logSection = document.getElementById('logSection');
const logToggle = document.getElementById('logToggle');
const logConsole = document.getElementById('logConsole');
const delayInput = document.getElementById('delayMs');

// === PAGE DETECTION ===
async function detectPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showStatus('err', 'No se pudo detectar la pestaña activa', '');
      showPanel('notSiged');
      return;
    }

    const url = tab.url || '';

    // Not on SIGED at all
    if (!url.includes('siged.com.uy')) {
      showStatus('err', 'No estás en SIGED', 'Abrí SIGED en el navegador primero');
      showPanel('notSiged');
      return;
    }

    // On SIGED - inject content script and ask for page analysis
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // May already be injected
    }

    // Small delay to let script initialize
    await new Promise(r => setTimeout(r, 300));

    // Ask content script what page we're on
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'detectPage' });

      if (response.pageType === 'desarrolloForm') {
        // Perfect - on the add/edit form
        showStatus('ok',
          '✅ Listo para cargar',
          response.libreta || 'Formulario de desarrollo del curso detectado'
        );
        showPanel('ready');
      } else if (response.pageType === 'desarrolloList') {
        // On the list view - also good, we'll click Nuevo
        showStatus('ok',
          '✅ Listo para cargar',
          response.libreta || 'Sección "Desarrollo del curso" detectada'
        );
        showPanel('ready');
      } else if (response.pageType === 'libretas') {
        showStatus('warn',
          'Estás en "Mis Libretas"',
          'Seleccioná una libreta y entrá a "Desarrollo del curso"'
        );
        showPanel('wrongSection');
      } else if (response.pageType === 'menuLibro') {
        showStatus('warn',
          'Estás dentro de una libreta',
          'Hacé clic en "Desarrollo del curso" en el menú de la libreta'
        );
        showPanel('wrongSection');
      } else {
        showStatus('warn',
          'Estás en SIGED, pero no en la sección correcta',
          'Navegá hasta "Desarrollo del curso" de una libreta'
        );
        showPanel('wrongSection');
      }
    } catch (e) {
      // Content script didn't respond - might be login page or other
      showStatus('warn',
        'Estás en SIGED',
        'Navegá hasta "Desarrollo del curso" de una libreta y volvé a abrir la extensión'
      );
      showPanel('wrongSection');
    }
  } catch (err) {
    showStatus('err', 'Error detectando la página', err.message);
    showPanel('notSiged');
  }
}

function showStatus(type, text, detail) {
  statusBanner.className = 'status-banner ' + type;
  statusText.textContent = text;
  statusDetail.textContent = detail || '';
  statusDetail.style.display = detail ? 'block' : 'none';
}

function showPanel(name) {
  panelNotSiged.classList.remove('active');
  panelWrongSection.classList.remove('active');
  panelReady.classList.remove('active');
  if (name === 'notSiged') panelNotSiged.classList.add('active');
  else if (name === 'wrongSection') panelWrongSection.classList.add('active');
  else if (name === 'ready') panelReady.classList.add('active');
}

// === RECONEXIÓN A UN PROCESO EN CURSO ===
// El popup se cierra al hacer clic afuera, pero la carga sigue corriendo en
// la página. Al reabrir, pedimos el estado al content script y restauramos
// la barra de progreso y el log.
function openLogConsole() {
  logConsole.classList.add('open');
  logToggle.textContent = '▼ Ver detalle técnico';
}
function updateProgressUI(current, total) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressCount.textContent = `${current} / ${total}`;
  progressLabel.textContent = (total && current === total) ? '¡Completado!' : 'Cargando...';
}
async function tryRestoreRun() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !(tab.url || '').includes('siged.com.uy')) return;
    const st = await chrome.tabs.sendMessage(tab.id, { action: 'getState' });
    if (!st || (!st.running && !st.logs?.length)) {
      try { chrome.action.setBadgeText({ text: '' }); } catch (e) {}
      return;
    }
    // Hay (o hubo) una carga: restaurar la vista de progreso + log
    showPanel('ready');
    cardRun.style.display = 'block';
    progressSection.classList.add('show');
    logSection.classList.add('show');
    openLogConsole();
    logConsole.innerHTML = '';
    for (const l of st.logs) addLog(l.text, l.type === 'error' ? 'err' : (l.type === 'ok' ? 'ok' : 'info'), l.time);
    updateProgressUI(st.current, st.total);
    if (st.running) {
      isRunning = true;
      btnRun.disabled = true;
      btnStop.classList.add('show');
      showStatus('ok', '⏳ Carga en curso...', `${st.current} de ${st.total} registros — no cierres la pestaña de SIGED`);
    } else {
      if (st.finished) {
        progressLabel.textContent = '¡Completado!';
        showStatus(st.errors ? 'warn' : 'ok',
          st.errors ? `Completado con ${st.errors} errores` : '✅ Carga completada',
          `${st.success} de ${st.total} registros cargados`);
      } else if (st.stopped) {
        showStatus('warn', 'Carga detenida', `Se cargaron ${st.success} de ${st.total} registros`);
      }
      try { chrome.action.setBadgeText({ text: '' }); } catch (e) {}
    }
  } catch (e) { /* sin content script en esta pestaña */ }
}

// Run detection on load, then re-attach to any run in progress
(async () => {
  await detectPage();
  await tryRestoreRun();
})();

// === CSV LOADING ===
csvFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    parseCSV(ev.target.result);
    if (parsedData.length > 0) {
      // Update UI
      uploadArea.classList.add('loaded');
      uploadIcon.textContent = '✅';
      uploadText.textContent = file.name;
      fileSummaryText.textContent = `${parsedData.length} registros listos para cargar`;
      fileSummary.classList.add('show');
      formatHelp.style.display = 'none';
      document.getElementById('cn1').classList.add('done');
      showPreview();
      // Show next cards
      cardConfig.style.display = 'block';
      cardRun.style.display = 'block';
      btnRun.disabled = false;
    }
  };
  reader.readAsText(file, 'UTF-8');
});

function parseCSV(text) {
  parsedData = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    showParseError('El archivo está vacío o no tiene datos.');
    return;
  }

  const header = lines[0];
  const sep = header.includes(';') ? ';' : ',';
  const headers = header.split(sep).map(h =>
    h.trim().replace(/^["']|["']$/g, '').toLowerCase()
     .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  // Detect columns
  let ci = { fecha: -1, dict: -1, noDict: -1, desarrollo: -1 };

  headers.forEach((h, i) => {
    if (h.includes('fecha')) ci.fecha = i;
    else if ((h.includes('no') && h.includes('dict')) || h.includes('no_dict') || h.includes('nodict'))
      ci.noDict = i;
    else if (h.includes('dict') || (h.includes('hora') && !h.includes('no')))
      ci.dict = i;
    else if (h.includes('desarrollo') || h.includes('contenido') || h.includes('tema') || h.includes('descripcion'))
      ci.desarrollo = i;
  });

  // If "horas no dictadas" wasn't matched separately, try again
  if (ci.noDict === -1) {
    headers.forEach((h, i) => {
      if (i !== ci.dict && h.includes('hora') && h.includes('no')) ci.noDict = i;
    });
  }

  // Fallback: assume positional if 4 columns
  if (ci.fecha === -1 && headers.length >= 4) {
    ci = { fecha: 0, dict: 1, noDict: 2, desarrollo: 3 };
  }

  if (ci.fecha === -1 || ci.desarrollo === -1) {
    showParseError('No se detectaron las columnas necesarias. Asegurate de tener al menos: Fecha y Desarrollo.');
    return;
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = smartSplit(lines[i].trim(), sep);
    if (!cols[ci.fecha]) continue;

    const fecha = normalizeDate(cols[ci.fecha]?.trim().replace(/^["']|["']$/g, '') || '');
    const dict = parseInt(cols[ci.dict]?.trim().replace(/^["']|["']$/g, '') || '0') || 0;
    const noDict = parseInt(cols[ci.noDict]?.trim().replace(/^["']|["']$/g, '') || '0') || 0;
    const desarrollo = cols[ci.desarrollo]?.trim().replace(/^["']|["']$/g, '') || '';

    if (!fecha) { addLog(`Fila ${i}: fecha inválida, se omite`, 'err'); continue; }
    if (!desarrollo) continue;

    parsedData.push({ fecha, dictadas: dict, noDictadas: noDict, desarrollo });
  }

  if (parsedData.length === 0) {
    showParseError('No se encontraron registros válidos. Verificá el formato del CSV.');
  }
}

function showParseError(msg) {
  fileSummary.classList.add('show');
  fileSummary.style.background = '#fef2f2';
  fileSummary.style.color = '#991b1b';
  fileSummaryText.textContent = msg;
  fileSummary.querySelector('span:first-child').textContent = '❌';
}

function smartSplit(line, sep) {
  const result = [];
  let current = '';
  let inQ = false;
  let qc = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (!inQ && (ch === '"' || ch === "'")) { inQ = true; qc = ch; }
    else if (inQ && ch === qc) { inQ = false; }
    else if (!inQ && ch === sep) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function normalizeDate(str) {
  str = str.trim();
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[3];
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return m[3].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + m[1];
  return null;
}

function showPreview() {
  previewBody.innerHTML = '';
  const max = Math.min(parsedData.length, 4);
  for (let i = 0; i < max; i++) {
    const r = parsedData[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(r.fecha)}</td>
      <td style="text-align:center">${r.dictadas}</td>
      <td style="text-align:center">${r.noDictadas}</td>
      <td title="${esc(r.desarrollo)}">${esc(r.desarrollo.substring(0, 45))}${r.desarrollo.length > 45 ? '…' : ''}</td>
    `;
    previewBody.appendChild(tr);
  }
  if (parsedData.length > 4) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align:center;color:#94a3b8;font-style:italic;font-size:11px;">…y ${parsedData.length - 4} registros más</td>`;
    previewBody.appendChild(tr);
  }
  previewSection.classList.add('show');
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// === EXECUTION ===
btnRun.addEventListener('click', async () => {
  if (parsedData.length === 0 || isRunning) return;

  isRunning = true;
  btnRun.disabled = true;
  btnStop.classList.add('show');
  progressSection.classList.add('show');
  logSection.classList.add('show');
  openLogConsole();
  logConsole.innerHTML = '';
  progressFill.style.width = '0%';

  const delay = parseInt(delayInput.value) || 3000;
  addLog(`Iniciando carga de ${parsedData.length} registros (pausa: ${delay}ms)`, 'info');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes('siged.com.uy')) {
    addLog('Error: No estás en SIGED', 'err');
    resetUI();
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) { /* already injected */ }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      action: 'startDesarrollo',
      data: parsedData,
      delay: delay
    });
    if (resp?.status === 'started') {
      addLog('Proceso iniciado en SIGED', 'ok');
    } else {
      addLog('Error al iniciar: ' + (resp?.error || 'sin respuesta'), 'err');
      resetUI();
    }
  } catch (err) {
    addLog('Error de comunicación. Recargá SIGED (F5) e intentá de nuevo.', 'err');
    resetUI();
  }
});

// Progress from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'progressUpdate') {
    const pct = Math.round((msg.current / msg.total) * 100);
    progressFill.style.width = pct + '%';
    progressCount.textContent = `${msg.current} / ${msg.total}`;
    progressLabel.textContent = msg.current === msg.total ? '¡Completado!' : 'Cargando...';
    addLog(msg.message, msg.status === 'ok' ? 'ok' : msg.status === 'error' ? 'err' : 'info');
  } else if (msg.action === 'processComplete') {
    const emoji = msg.errors === 0 ? '🎉' : '⚠️';
    addLog(`${emoji} Completado: ${msg.success}/${msg.total} registros cargados`, 'ok');
    if (msg.errors > 0) addLog(`${msg.errors} registros con error`, 'err');
    progressLabel.textContent = '¡Completado!';
    progressFill.style.width = '100%';
    resetUI();
  } else if (msg.action === 'processStopped') {
    addLog('Proceso detenido', 'info');
    resetUI();
  }
});

btnStop.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { action: 'stopDesarrollo' });
  isRunning = false;
  resetUI();
});

function resetUI() {
  isRunning = false;
  btnRun.disabled = parsedData.length === 0;
  btnStop.classList.remove('show');
}

function addLog(text, type = 'info', time = null) {
  const d = document.createElement('div');
  d.className = 'log-entry ' + type;
  const t = time || new Date().toLocaleTimeString('es-UY', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  d.textContent = `[${t}] ${text}`;
  logConsole.appendChild(d);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// Log toggle
logToggle.addEventListener('click', () => {
  const open = logConsole.classList.toggle('open');
  logToggle.textContent = (open ? '▼' : '▶') + ' Ver detalle técnico';
});
