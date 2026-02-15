document.addEventListener('DOMContentLoaded', async () => {
  const subtitleEl = document.getElementById('currentSite');
  const banner = document.getElementById('banner');
  const features = document.getElementById('features');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let isSupportedSite = false;

  if (tab?.url) {
    try {
      const hostname = new URL(tab.url).hostname;
      const site = LigaEnhancedConfig.SITES.find(s => s.domain === hostname);
      if (site) {
        subtitleEl.textContent = site.name;
        isSupportedSite = true;
      }
    } catch (e) {}
  }

  if (!isSupportedSite) {
    banner.style.display = '';
    features.style.display = 'none';
  }
});
