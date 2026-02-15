// Liga Enhanced - Bridge (ISOLATED world)
// Bidirectional sync between chrome.storage.sync and localStorage
(function () {
  'use strict';

  var CONFIG_KEY = 'le_config';
  var SYNC_KEYS = ['le_collection_id', 'le_collection_name', 'le_match_mode', 'le_consider_qty'];
  var DEFAULTS = { le_collection_id: '', le_collection_name: '', le_match_mode: 'name', le_consider_qty: true };

  function syncToLocal() {
    chrome.storage.sync.get(DEFAULTS, function (data) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(data));
      } catch (e) { /* ignore */ }
      try {
        document.dispatchEvent(new CustomEvent('le-config-changed'));
      } catch (e) { /* ignore */ }
    });
  }

  syncToLocal();

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync') syncToLocal();
  });

  document.addEventListener('le-config-save', function () {
    try {
      var config = JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
      var update = {};
      SYNC_KEYS.forEach(function (key) {
        if (key in config) update[key] = config[key];
      });
      chrome.storage.sync.set(update);
    } catch (e) { /* ignore */ }
  });
})();
