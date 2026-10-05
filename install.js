// Velora universal PWA installer
(() => {
  let deferredPrompt = null;
  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const $ = id => document.getElementById(id);
  const toastMsg = msg => {
    if (typeof window.toast === 'function') return window.toast(msg);
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastMsg.t);
    toastMsg.t = setTimeout(() => t.classList.remove('on'), 2600);
  };

  function platform() {
    const ua = navigator.userAgent || '';
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isSamsung = /SamsungBrowser/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge;
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|Android/i.test(ua);
    const isTV = /Android TV|GoogleTV|SMART-TV|SmartTV|Tizen|WebOS|webOS|NetCast|BRAVIA|AFT|FireTV|TV Safari/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isiOS;
    return {ua, isiOS, isAndroid, isSamsung, isFirefox, isEdge, isChrome, isSafari, isTV, isMac};
  }

  function setButtonState() {
    const btn = $('installAppBtn');
    if (!btn) return;
    if (isStandalone()) {
      btn.classList.add('installed');
      btn.querySelector('[data-install-label]').textContent = 'Velora Installed';
      btn.setAttribute('aria-label', 'Velora is installed');
      return;
    }
    btn.classList.remove('installed');
    btn.querySelector('[data-install-label]').textContent = deferredPrompt ? 'Install Velora' : 'Install App';
    btn.setAttribute('aria-label', 'Install Velora TV');
  }

  function showModal() {
    const p = platform();
    const modal = $('installModal');
    const title = $('installModalTitle');
    const body = $('installModalBody');
    const action = $('installModalAction');
    if (!modal || !title || !body || !action) return;

    action.classList.add('hidden');
    action.onclick = null;

    if (p.isTV) {
      title.textContent = 'Install Velora on this TV';
      body.innerHTML =
        '<p>Velora is ready as an installable web app where the TV browser supports PWA installation.</p>' +
        '<ol><li>Open the browser menu.</li><li>Look for <b>Install app</b>, <b>Add to Apps</b>, or <b>Add to Home</b>.</li><li>If your TV browser does not offer one of those options, that TV platform does not allow browser-installed PWAs.</li></ol>' +
        '<p class="installFinePrint">Android/Google TV, Fire TV, Samsung Tizen and LG webOS do not all expose the same browser-install feature. A packaged TV app is required for guaranteed TV installation.</p>';
      action.textContent = 'Launch Full-screen TV Mode';
      action.classList.remove('hidden');
      action.onclick = async () => {
        try { await document.documentElement.requestFullscreen?.(); } catch {}
        modal.classList.remove('on');
      };
    } else if (p.isiOS) {
      title.textContent = 'Install Velora on iPhone or iPad';
      body.innerHTML =
        '<ol><li>Open Velora in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The Velora icon will appear like a normal app.</li></ol>';
    } else if (p.isSafari && p.isMac) {
      title.textContent = 'Install Velora on Mac';
      body.innerHTML =
        '<ol><li>In Safari, open the <b>File</b> menu.</li><li>Choose <b>Add to Dock…</b>.</li><li>Confirm the name Velora TV.</li></ol><p>Velora then opens in its own app window from the Dock or Applications.</p>';
    } else if (p.isSamsung) {
      title.textContent = 'Install Velora';
      body.innerHTML =
        '<ol><li>Open the Samsung Internet menu.</li><li>Choose <b>Add page to</b>.</li><li>Select <b>Apps screen</b> or <b>Home screen</b>.</li></ol>';
    } else if (p.isFirefox && p.isAndroid) {
      title.textContent = 'Install Velora';
      body.innerHTML =
        '<ol><li>Open the Firefox menu.</li><li>Choose <b>Install</b> or <b>Add to Home screen</b>.</li><li>Confirm.</li></ol>';
    } else {
      title.textContent = 'Install Velora';
      body.innerHTML =
        '<p>Your browser did not expose its one-click install prompt yet.</p>' +
        '<ol><li>Open the browser menu.</li><li>Choose <b>Install Velora</b>, <b>Install app</b>, or <b>Add to Home Screen</b>.</li></ol>' +
        '<p class="installFinePrint">Chrome and Edge can also show an install icon in the address bar once the app is installable.</p>';
    }
    modal.classList.add('on');
  }

  async function install() {
    if (isStandalone()) {
      toastMsg('Velora is already installed on this device.');
      return;
    }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => ({outcome:'dismissed'}));
      if (choice?.outcome === 'accepted') toastMsg('Velora installation started.');
      setButtonState();
      return;
    }
    showModal();
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    setButtonState();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setButtonState();
    $('installModal')?.classList.remove('on');
    toastMsg('Velora installed successfully.');
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#installAppBtn')) {
      e.preventDefault();
      install();
      return;
    }
    if (e.target.closest('[data-close-install]') || e.target.id === 'installModal') {
      $('installModal')?.classList.remove('on');
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    setButtonState();
    // Register here too so the installer works even if app.js changes later.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(() => {});
    }
  });

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', setButtonState);
})();
