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
    const isSamsungBrowser = /SamsungBrowser/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge;
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|Android/i.test(ua);
    const isAndroidTV = /Android TV|GoogleTV|Google TV|BRAVIA|SHIELD|MiTV|MiBOX|Chromecast/i.test(ua);
    const isFireTV = /AFT|FireTV|Fire TV|Silk\//i.test(ua);
    const isSamsungTV = /Tizen|SMART-TV|SmartTV/i.test(ua);
    const isLGTV = /Web0S|WebOS|webOS|NetCast/i.test(ua);
    const isTV = isAndroidTV || isFireTV || isSamsungTV || isLGTV || /TV Safari/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isiOS;
    const tvFamily = isFireTV ? 'Fire TV' : isAndroidTV ? 'Android / Google TV' : isSamsungTV ? 'Samsung TV' : isLGTV ? 'LG TV' : isTV ? 'Smart TV' : '';
    return {ua, isiOS, isAndroid, isSamsungBrowser, isFirefox, isEdge, isChrome, isSafari, isAndroidTV, isFireTV, isSamsungTV, isLGTV, isTV, isMac, tvFamily};
  }
  function setButtonState() {
    const btn = $('installAppBtn');
    if (!btn) return;
    const p = platform();
    if (isStandalone()) {
      btn.classList.add('installed');
      btn.querySelector('[data-install-label]').textContent = 'Velora Installed';
      btn.setAttribute('aria-label', 'Velora is installed');
      return;
    }
    btn.classList.remove('installed');
    let label = 'Install App';
    if (deferredPrompt) label = 'Install Velora';
    else if (p.isTV) label = 'TV Install';
    btn.querySelector('[data-install-label]').textContent = label;
    btn.setAttribute('aria-label', p.isTV ? 'Install Velora on TV' : 'Install Velora TV');
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
      title.textContent = 'Velora detected ' + (p.tvFamily || 'your TV');
      if (p.isAndroidTV || p.isFireTV) {
        body.innerHTML =
          '<p>This TV browser did <b>not</b> expose a web-app installation prompt, so Velora cannot install itself from this browser.</p>' +
          '<p>The correct route for this device is a packaged <b>TV app</b> (Android/Fire TV APK). Once that package is available, Velora can detect this TV and offer the TV-app installer instead of PWA instructions.</p>' +
          '<p class="installFinePrint">The TV operating system still requires you to approve the installation. A website is not allowed to bypass that confirmation.</p>';
      } else if (p.isSamsungTV) {
        body.innerHTML =
          '<p>This appears to be a <b>Samsung Tizen TV</b>. Its browser is not exposing PWA installation.</p>' +
          '<p>The reliable installation route is a packaged Samsung TV app, not a browser-installed web app.</p>';
      } else if (p.isLGTV) {
        body.innerHTML =
          '<p>This appears to be an <b>LG webOS TV</b>. Its browser is not exposing PWA installation.</p>' +
          '<p>The reliable installation route is a packaged LG webOS app, not a browser-installed web app.</p>';
      } else {
        body.innerHTML =
          '<p>Your TV browser does not expose a web-app installation API. Velora therefore cannot truthfully offer a one-click browser install on this TV.</p>' +
          '<p>The reliable route is a packaged app for the TV operating system.</p>';
      }
      action.textContent = 'Open Velora Full Screen';
      action.classList.remove('hidden');
      action.onclick = async () => {
        try { await document.documentElement.requestFullscreen?.(); } catch {}
        modal.classList.remove('on');
      };
    } else if (p.isiOS) {
      title.textContent = 'Install Velora on iPhone or iPad';
      body.innerHTML =
        '<p>iOS does not let websites trigger the install sheet automatically.</p>' +
        '<ol><li>Open Velora in <b>Safari</b>.</li><li>Tap <b>Share</b>.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>';
    } else if (p.isSafari && p.isMac) {
      title.textContent = 'Install Velora on Mac';
      body.innerHTML =
        '<ol><li>In Safari open <b>File</b>.</li><li>Choose <b>Add to Dock…</b>.</li><li>Confirm Velora TV.</li></ol>';
    } else if (p.isSamsungBrowser) {
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
        '<p>This browser did not expose its native install prompt yet.</p>' +
        '<p>If the browser supports installable web apps, its own <b>Install app</b> or <b>Add to Home Screen</b> command will be the available route.</p>';
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
