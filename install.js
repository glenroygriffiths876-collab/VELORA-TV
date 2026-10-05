// Velora smart universal installer — routes each device to its native install path.
(() => {
  let deferredPrompt = null;
  const APK_URL = new URL('./downloads/VELORA-TV.apk', location.href).href;

  const $ = id => document.getElementById(id);
  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const toastMsg = msg => {
    if (typeof window.toast === 'function') return window.toast(msg);
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastMsg.t);
    toastMsg.t = setTimeout(() => t.classList.remove('on'), 3000);
  };

  function platform() {
    const ua = navigator.userAgent || '';
    const isiOS = /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isSamsungBrowser = /SamsungBrowser/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isEdge = /Edg\//i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge;
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|Android/i.test(ua);
    const isFireTV = /AFT|FireTV|Fire TV|Silk\//i.test(ua);
    const isAndroidTV = !isFireTV && /Android TV|GoogleTV|Google TV|BRAVIA|SHIELD|MiTV|MiBOX|Chromecast|NVIDIA SHIELD|ADT-/i.test(ua);
    const isSamsungTV = /Tizen|SMART-TV|SmartTV/i.test(ua) && !isAndroid;
    const isLGTV = /Web0S|WebOS|webOS|NetCast|LG Browser/i.test(ua);
    const isVIDAA = /VIDAA|Hisense.*TV|HisenseBrowser/i.test(ua);
    const isRoku = /Roku|DVP-/i.test(ua);
    const isVizio = /VIZIO|SmartCast/i.test(ua);
    const isTV = isAndroidTV || isFireTV || isSamsungTV || isLGTV || isVIDAA || isRoku || isVizio ||
      /TV Safari|HbbTV|SmartTV|SMART-TV|Television/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isiOS;
    const tvFamily =
      isFireTV ? 'Amazon Fire TV' :
      isAndroidTV ? 'Android / Google TV' :
      isSamsungTV ? 'Samsung TV' :
      isLGTV ? 'LG TV' :
      isVIDAA ? 'VIDAA / Hisense TV' :
      isRoku ? 'Roku TV' :
      isVizio ? 'VIZIO SmartCast' :
      isTV ? 'Smart TV' : '';
    return {
      ua, isiOS, isAndroid, isSamsungBrowser, isFirefox, isEdge, isChrome, isSafari,
      isAndroidTV, isFireTV, isSamsungTV, isLGTV, isVIDAA, isRoku, isVizio, isTV, isMac, tvFamily
    };
  }

  function installBadge(icon, title, detail, cls='') {
    return `<div class="smartInstallRoute ${cls}">
      <div class="smartInstallRouteIcon">${icon}</div>
      <div><b>${title}</b><small>${detail}</small></div>
    </div>`;
  }

  function setButtonState() {
    const btn = $('installAppBtn');
    if (!btn) return;
    const p = platform();
    const label = btn.querySelector('[data-install-label]');

    if (isStandalone()) {
      btn.classList.add('installed');
      if (label) label.textContent = 'Velora Installed';
      btn.setAttribute('aria-label', 'Velora is installed');
      return;
    }

    btn.classList.remove('installed');
    if (label) {
      if (deferredPrompt) label.textContent = 'Install Velora';
      else if (p.isTV) label.textContent = 'Install on TV';
      else label.textContent = 'Install App';
    }
    btn.setAttribute('aria-label', p.isTV ? 'Install Velora on this TV' : 'Install Velora');
  }

  function resetAction(action) {
    action.classList.add('hidden');
    action.onclick = null;
    action.removeAttribute('data-route');
  }

  function openModal() {
    const modal = $('installModal');
    if (modal) {
      modal.classList.add('on');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeModal() {
    const modal = $('installModal');
    if (modal) {
      modal.classList.remove('on');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function startTvMode() {
    const u = new URL(location.href);
    u.searchParams.set('tv', '1');
    location.href = u.href;
  }

  function directApkInstall(action, p) {
    action.textContent = 'Install VELORA';
    action.classList.remove('hidden');
    action.dataset.route = 'apk';
    action.onclick = () => {
      toastMsg('Opening the VELORA TV installer…');
      location.href = APK_URL;
      setTimeout(() => {
        if (!document.hidden) {
          const body = $('installModalBody');
          if (body) {
            body.insertAdjacentHTML('beforeend',
              '<p class="installFinePrint">If this TV blocks downloaded apps, its security settings must allow app installation from this browser. VELORA cannot bypass the TV manufacturer\'s approval screen.</p>');
          }
        }
      }, 1800);
    };

    return installBadge(
      '✓',
      'VELORA TV app found',
      `${p.tvFamily} • dedicated remote-control version`,
      'ready'
    ) +
    '<p class="smartInstallLead">Press <b>Install VELORA</b>. Your TV will handle the final approval screen.</p>';
  }

  function storePendingBody(p, storeName) {
    return installBadge('TV', p.tvFamily, `${storeName} installation route detected`, 'detected') +
      '<p class="smartInstallLead">VELORA has identified the correct TV platform automatically.</p>' +
      `<p>The remaining step is publishing the VELORA package in <b>${storeName}</b>. Until that listing is live, this TV does not permit a website to place an app icon on its home screen.</p>` +
      '<p class="installFinePrint">You can still use the TV-optimized interface now. Once the store package is published, this same Install button can open the correct listing automatically.</p>';
  }

  function showSmartRoute() {
    const p = platform();
    const modal = $('installModal');
    const title = $('installModalTitle');
    const body = $('installModalBody');
    const action = $('installModalAction');
    if (!modal || !title || !body || !action) return;

    resetAction(action);
    title.textContent = p.isTV ? 'Install VELORA on this TV' : 'Install VELORA';

    if (p.isAndroidTV || p.isFireTV) {
      body.innerHTML = directApkInstall(action, p);
      openModal();
      return;
    }

    if (p.isSamsungTV) {
      body.innerHTML = storePendingBody(p, 'Samsung Apps / Tizen');
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isLGTV) {
      body.innerHTML = storePendingBody(p, 'LG Content Store / webOS');
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isVIDAA) {
      body.innerHTML = storePendingBody(p, 'VIDAA App Store');
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isRoku) {
      body.innerHTML = storePendingBody(p, 'Roku Channel Store');
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isVizio) {
      body.innerHTML = storePendingBody(p, 'VIZIO / SmartCast');
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isTV) {
      body.innerHTML =
        installBadge('?', p.tvFamily || 'Smart TV', 'TV platform detected', 'detected') +
        '<p class="smartInstallLead">This TV browser does not expose enough platform information for a safe automatic package choice.</p>' +
        '<p>VELORA will not guess and send your TV the wrong app. You can launch the remote-friendly TV interface now.</p>';
      action.textContent = 'Use VELORA TV Mode';
      action.classList.remove('hidden');
      action.onclick = startTvMode;
      openModal();
      return;
    }

    if (p.isiOS) {
      body.innerHTML =
        installBadge('↗', 'iPhone / iPad', 'Apple Home Screen installation', 'detected') +
        '<ol><li>Open VELORA in <b>Safari</b>.</li><li>Tap <b>Share</b>.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>';
      openModal();
      return;
    }

    if (p.isSafari && p.isMac) {
      body.innerHTML =
        installBadge('⌘', 'Mac', 'Safari web app installation', 'detected') +
        '<ol><li>In Safari open <b>File</b>.</li><li>Choose <b>Add to Dock…</b>.</li><li>Confirm VELORA.</li></ol>';
      openModal();
      return;
    }

    if (p.isSamsungBrowser) {
      body.innerHTML =
        installBadge('＋', 'Samsung Internet', 'Home-screen installation', 'detected') +
        '<ol><li>Open the Samsung Internet menu.</li><li>Choose <b>Add page to</b>.</li><li>Select <b>Apps screen</b> or <b>Home screen</b>.</li></ol>';
      openModal();
      return;
    }

    if (p.isFirefox && p.isAndroid) {
      body.innerHTML =
        installBadge('＋', 'Android / Firefox', 'Home-screen installation', 'detected') +
        '<ol><li>Open the Firefox menu.</li><li>Choose <b>Install</b> or <b>Add to Home screen</b>.</li><li>Confirm.</li></ol>';
      openModal();
      return;
    }

    body.innerHTML =
      installBadge('✓', 'Device detected', 'VELORA will use the browser-supported installer', 'detected') +
      '<p>This browser has not exposed its native installation prompt yet. If it supports installable web apps, use its <b>Install app</b> or <b>Add to Home Screen</b> command.</p>';
    openModal();
  }

  async function install() {
    if (isStandalone()) {
      toastMsg('VELORA is already installed on this device.');
      return;
    }

    const p = platform();

    // TV packages take priority over a browser PWA prompt, so the result behaves like a real TV app.
    if (p.isTV) {
      showSmartRoute();
      return;
    }

    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => ({outcome:'dismissed'}));
      if (choice?.outcome === 'accepted') toastMsg('VELORA installation started.');
      setButtonState();
      return;
    }

    showSmartRoute();
  }

  window.VeloraInstall = {
    platform,
    install,
    apkUrl: APK_URL
  };

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    setButtonState();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setButtonState();
    closeModal();
    toastMsg('VELORA installed successfully.');
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#installAppBtn')) {
      e.preventDefault();
      install();
      return;
    }
    if (e.target.closest('[data-close-install]') || e.target.id === 'installModal') {
      closeModal();
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    setButtonState();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', {scope:'./'}).catch(() => {});
    }
  });

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', setButtonState);
})();