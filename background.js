// background.js - SIGED Desarrollo del Curso
// Insignia de progreso en el ícono de la extensión: permite ver por dónde
// va la carga sin tener el popup abierto (los popups se cierran al hacer
// clic afuera, pero el proceso sigue corriendo en la página de SIGED).

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'progressUpdate' && msg.total) {
    const pct = Math.round((msg.current / msg.total) * 100);
    chrome.action.setBadgeBackgroundColor({ color: '#1a6fb5' });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
    chrome.action.setBadgeText({ text: pct + '%' });
  } else if (msg.action === 'processComplete') {
    chrome.action.setBadgeBackgroundColor({ color: msg.errors ? '#f59e0b' : '#10b981' });
    chrome.action.setBadgeText({ text: msg.errors ? '!' : 'OK' });
  } else if (msg.action === 'processStopped') {
    chrome.action.setBadgeText({ text: '' });
  }
});
