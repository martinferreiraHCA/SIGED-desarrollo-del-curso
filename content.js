// content.js - SIGED Desarrollo del Curso
// Detects page state, fills forms, handles Guardar→Nuevo cycle

(function() {
  // Prevent double-injection
  if (window.__sigedDesarrolloLoaded) return;
  window.__sigedDesarrolloLoaded = true;

  console.log('📘 SIGED Desarrollo del Curso - Content Script v1.0');

  let shouldStop = false;
  let isProcessing = false;

  // Los IDs de GeneXus llevan un prefijo de componente (ej. W00450001) que puede
  // variar entre instalaciones de SIGED. Si el ID exacto no existe, se busca por sufijo.
  function gxEl(id) {
    let el = document.getElementById(id);
    if (el) return el;
    const suf = id.replace(/^W\d+/, '');
    if (suf && suf !== id) {
      el = document.querySelector('[id$="' + suf + '"]');
      if (el) return el;
    }
    return null;
  }

  // === MESSAGE LISTENER ===
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.action === 'detectPage') {
      const result = analyzePage();
      sendResponse(result);
      return true;
    }

    if (msg.action === 'startDesarrollo') {
      if (isProcessing) {
        sendResponse({ status: 'error', error: 'Ya hay un proceso en ejecución' });
        return true;
      }
      shouldStop = false;
      isProcessing = true;
      runAllRecords(msg.data, msg.delay);
      sendResponse({ status: 'started' });
      return true;
    }

    if (msg.action === 'stopDesarrollo') {
      shouldStop = true;
      sendResponse({ status: 'stopping' });
      return true;
    }

    return false;
  });

  // === PAGE ANALYSIS ===
  function analyzePage() {
    const url = window.location.href;
    const title = document.title || '';
    const result = { pageType: 'unknown', libreta: '', url: url };

    // Check for "Agregar Desarrollo del curso" form
    const formTitle = document.getElementById('TXTTITULO');
    if (formTitle) {
      const txt = formTitle.textContent || '';
      if (txt.includes('Desarrollo del curso')) {
        result.pageType = 'desarrolloForm';
        // Extract libreta name from title (after "::")
        const parts = txt.split('::');
        if (parts.length > 1) result.libreta = parts[1].trim();
        return result;
      }
    }

    // Check for "Desarrollo del curso" section header
    const sectionTitle = document.getElementById('TXTSECCION');
    if (sectionTitle && sectionTitle.textContent.includes('Desarrollo del curso')) {
      result.pageType = 'desarrolloList';
      // Try to get libreta name from page title
      if (title.includes('::')) {
        result.libreta = title.split('::').pop().trim();
      }
      return result;
    }

    // Check for Nuevo button + any desarrollo-related content
    const nuevoBtn = document.querySelector('img[alt="Nuevo"][src*="btn_nuevo"]') ||
                     gxEl('W00500001IMGNUEVO');
    const hasFechaField = gxEl('W00450001vFECVAL1_0001');

    if (hasFechaField) {
      result.pageType = 'desarrolloForm';
      return result;
    }

    if (nuevoBtn) {
      // Could be desarrollo list or other ABM section
      const pageText = document.body.textContent || '';
      if (pageText.includes('Desarrollo del curso')) {
        result.pageType = 'desarrolloList';
        return result;
      }
    }

    // Check for libretas page
    if (url.includes('mislibretas') || url.includes('mislibretasrwd')) {
      result.pageType = 'libretas';
      return result;
    }

    // Check for menu libro profesor (inside a libreta but not on desarrollo)
    if (url.includes('menulibroprofesor') || url.includes('seccionlibreta')) {
      result.pageType = 'menuLibro';
      return result;
    }

    // On SIGED but unknown section
    if (url.includes('siged.com.uy')) {
      result.pageType = 'sigedOther';
    }

    return result;
  }

  // === MAIN AUTOMATION LOOP ===
  async function runAllRecords(records, delay) {
    let success = 0;
    let errors = 0;
    const total = records.length;

    progress(0, total, 'info', `Iniciando carga de ${total} registros...`);

    for (let i = 0; i < total; i++) {
      if (shouldStop) {
        notify('processStopped');
        isProcessing = false;
        return;
      }

      const rec = records[i];
      progress(i + 1, total, 'info', `[${i+1}/${total}] Procesando: ${rec.fecha}`);

      try {
        // STEP A: Make sure we're on the form
        await ensureOnForm();

        // STEP B: Fill all fields
        await fillForm(rec);
        progress(i + 1, total, 'info', `[${i+1}/${total}] Campos completados, guardando...`);

        // STEP C: Click Guardar
        clickGuardar();

        // STEP D: Wait for save to complete
        await waitForSave(12000);

        // STEP E: Wait the configured delay
        await sleep(delay);

        success++;
        progress(i + 1, total, 'ok', `[${i+1}/${total}] ✅ Guardado: ${rec.fecha} — ${rec.desarrollo.substring(0, 40)}...`);

      } catch (err) {
        errors++;
        progress(i + 1, total, 'error', `[${i+1}/${total}] ❌ Error: ${err.message}`);
        console.error('📘 Error en registro', i + 1, err);
        // Wait and try to recover
        await sleep(3000);
      }
    }

    notify('processComplete', { total, success, errors });
    isProcessing = false;
  }

  // === ENSURE WE'RE ON THE FORM ===
  async function ensureOnForm() {
    const dateField = gxEl('W00450001vFECVAL1_0001');
    if (dateField && isVisible(dateField)) {
      // Already on form - still make sure CKEditor is ready
      await waitForCKEditorReady('W00450001vTXTVAL1_0004', 5000);
      return;
    }

    // Need to click "Nuevo"
    console.log('📘 Buscando botón Nuevo...');

    const clicked = clickNuevo();
    if (!clicked) {
      throw new Error('No se encontró el botón "Nuevo". Verificá que estés en "Desarrollo del curso".');
    }

    // Wait for form to appear
    await waitForElement('W00450001vFECVAL1_0001', 10000);
    // Wait for CKEditor to be fully ready (much more reliable than a fixed delay)
    await waitForCKEditorReady('W00450001vTXTVAL1_0004', 10000);
  }

  // Wait until the CKEditor instance bound to `textareaId` is ready to receive data
  async function waitForCKEditorReady(textareaId, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ed = findEditorForTextarea(textareaId);
      if (ed && ed.status === 'ready') return ed;
      await sleep(200);
    }
    // Give it one last chance - editor may still be usable even if status !== ready
    return findEditorForTextarea(textareaId);
  }

  // Find the CKEditor instance attached to a given textarea id.
  function findEditorForTextarea(textareaId) {
    if (typeof CKEDITOR === 'undefined' || !CKEDITOR.instances) return null;
    // Most common: editor name matches textarea id
    if (CKEDITOR.instances[textareaId]) return CKEDITOR.instances[textareaId];
    const ta = gxEl(textareaId);
    if (!ta) return null;
    if (ta.id !== textareaId && CKEDITOR.instances[ta.id]) return CKEDITOR.instances[ta.id];
    for (const name in CKEDITOR.instances) {
      const ed = CKEDITOR.instances[name];
      try {
        if (ed.element && ed.element.$ === ta) return ed;
      } catch (e) { /* ignore */ }
      // Also check if the editor's DOM wrapper is inside the textarea's parent
      const wrapper = document.getElementById('cke_' + name);
      if (wrapper && ta.parentElement && ta.parentElement.contains(wrapper)) return ed;
    }
    return null;
  }

  function clickNuevo() {
    // Try multiple selectors
    const selectors = [
      '#W00500001IMGNUEVO',
      '[id$="IMGNUEVO"]',
      'img[alt="Nuevo"]',
      'img[src*="btn_nuevo"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        el.click();
        console.log('📘 Clic en Nuevo:', sel);
        return true;
      }
    }
    return false;
  }

  // === FILL FORM ===
  async function fillForm(rec) {
    // Date
    const dateField = gxEl('W00450001vFECVAL1_0001');
    if (!dateField) throw new Error('Campo de fecha no encontrado');
    setGXValue(dateField, rec.fecha);

    // Horas dictadas
    const hDict = gxEl('W00450001vENTVAL1_0002');
    if (hDict) setGXValue(hDict, String(rec.dictadas));

    // Horas no dictadas
    const hNoDict = gxEl('W00450001vENTVAL1_0003');
    if (hNoDict) setGXValue(hNoDict, String(rec.noDictadas));

    // Desarrollo text (CKEditor)
    await setDesarrolloText(rec.desarrollo);

    // Let GeneXus process events
    await sleep(400);
  }

  function setGXValue(el, value) {
    el.focus();
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    if (el.dataset && el.dataset.gxoldvalue !== undefined) {
      el.dataset.gxoldvalue = value;
    }
  }

  async function setDesarrolloText(text) {
    const htmlText = '<p>' + escHtml(text) + '</p>';
    const textarea = gxEl('W00450001vTXTVAL1_0004');
    const textareaId = textarea ? textarea.id : 'W00450001vTXTVAL1_0004';

    // Method 1: CKEditor API (most reliable) - find the editor bound to our textarea
    let editor = findEditorForTextarea(textareaId);

    // If no editor yet, give it a moment to initialize
    if (!editor) {
      editor = await waitForCKEditorReady(textareaId, 3000);
    }

    if (editor) {
      // Write via CKEditor API and wait for it to finish
      await new Promise((resolve) => {
        try {
          editor.setData(htmlText, { callback: resolve });
        } catch (e) {
          // Some CKEditor versions use the older signature
          editor.setData(htmlText);
          setTimeout(resolve, 300);
        }
      });

      // CRITICAL: sync the editor content back to the underlying textarea.
      // GeneXus reads the textarea value on submit, not the CKEditor instance.
      try { editor.updateElement(); } catch (e) { /* ignore */ }

      // Belt-and-suspenders: also write the textarea directly and fire events
      if (textarea) {
        textarea.value = htmlText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        if (textarea.dataset && textarea.dataset.gxoldvalue !== undefined) {
          textarea.dataset.gxoldvalue = htmlText;
        }
      }

      // Let GeneXus process the change event
      await sleep(300);

      // Verify the textarea actually has the content; if not, write it again
      if (textarea && !textarea.value) {
        try { editor.updateElement(); } catch (e) { /* ignore */ }
        textarea.value = htmlText;
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log('📘 Desarrollo escrito via CKEditor:', editor.name);
      return;
    }

    // Method 2: Direct iframe manipulation (visual) + textarea (submit value)
    const iframes = document.querySelectorAll('.cke_wysiwyg_frame');
    let iframeWritten = false;
    for (const iframe of iframes) {
      try {
        if (!isVisible(iframe)) continue;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.body) {
          doc.body.innerHTML = htmlText;
          iframeWritten = true;
          console.log('📘 Desarrollo escrito via iframe');
          break;
        }
      } catch (e) { /* cross-origin */ }
    }

    // Method 3: Textarea fallback (must include HTML wrapping, not plain text)
    if (textarea) {
      textarea.value = htmlText;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      if (textarea.dataset && textarea.dataset.gxoldvalue !== undefined) {
        textarea.dataset.gxoldvalue = htmlText;
      }
      console.log('📘 Desarrollo escrito via textarea (fallback)');
      return;
    }

    if (iframeWritten) return;

    throw new Error('No se pudo escribir el texto de desarrollo');
  }

  // === GUARDAR ===
  function clickGuardar() {
    const btn = gxEl('W00450001BTNGUARDAR');
    if (btn && isVisible(btn)) {
      btn.click();
      console.log('📘 Clic en Guardar');
      return;
    }
    // Fallback
    const buttons = document.querySelectorAll('input[type="button"][value="Guardar"]');
    for (const b of buttons) {
      if (isVisible(b)) { b.click(); console.log('📘 Clic en Guardar (fallback)'); return; }
    }
    throw new Error('Botón "Guardar" no encontrado');
  }

  // === WAIT FOR SAVE ===
  async function waitForSave(timeout) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      // Check if the form disappeared (went back to list view)
      const dateField = gxEl('W00450001vFECVAL1_0001');
      if (!dateField || !isVisible(dateField)) {
        console.log('📘 Guardado: formulario cerrado');
        return;
      }

      // Check for error messages (el prefijo del data-gx-id varía por instalación)
      const errViewer = document.querySelector('[data-gx-id$="gxErrorViewer"]');
      if (errViewer && errViewer.textContent.trim()) {
        const msg = errViewer.textContent.trim();
        console.log('📘 Mensaje post-guardado:', msg);
        // Could be success or error - continue anyway
        return;
      }

      // Check if "Nuevo" button is now visible (returned to list)
      const nuevoBtn = document.querySelector('img[alt="Nuevo"]');
      if (nuevoBtn && isVisible(nuevoBtn)) {
        // Only if the form fields are gone
        if (!dateField || !isVisible(dateField)) {
          console.log('📘 Guardado: botón Nuevo visible');
          return;
        }
      }

      await sleep(300);
    }

    // Timeout - assume success
    console.log('📘 Timeout esperando guardado - continuando');
  }

  // === UTILITIES ===
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && el.style?.display !== 'fixed') return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  function waitForElement(id, timeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = gxEl(id);
        if (el && isVisible(el)) { resolve(el); return; }
        if (Date.now() - start > timeout) { reject(new Error(`Timeout: elemento "${id}" no apareció`)); return; }
        setTimeout(check, 250);
      };
      check();
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function progress(current, total, status, message) {
    try {
      // El popup puede estar cerrado: la promesa rechazada se ignora en silencio
      const p = chrome.runtime.sendMessage({
        action: 'progressUpdate',
        current, total, status, message
      });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.log('📘', message);
    }
  }

  function notify(action, data = {}) {
    try {
      const p = chrome.runtime.sendMessage({ action, ...data });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {
      console.log('📘 Notify:', action, data);
    }
  }

})();
