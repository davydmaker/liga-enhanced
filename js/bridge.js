// Liga Enhanced - Bridge (ISOLATED world)
// Bidirectional sync between chrome.storage and localStorage
(function () {
  "use strict";

  var CONFIG_KEY = "le_config";
  var BLOCKED_KEY = "le_blocked_cards";
  var IMGS_KEY = "le_blocked_imgs";
  var SYNC_KEYS = [
    "le_collection_id",
    "le_collection_name",
    "le_match_mode",
    "le_consider_qty",
  ];
  var DEFAULTS = {
    le_collection_id: "",
    le_collection_name: "",
    le_match_mode: "name",
    le_consider_qty: true,
  };

  // ─── Config sync (chrome.storage.sync ↔ localStorage) ───

  function syncConfigToLocal() {
    chrome.storage.sync.get(DEFAULTS, function (data) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(data));
      } catch (e) {
        /* ignore */
      }
      try {
        document.dispatchEvent(new CustomEvent("le-config-changed"));
      } catch (e) {
        /* ignore */
      }
    });
  }

  syncConfigToLocal();

  document.addEventListener("le-config-save", function () {
    try {
      var config = JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
      var update = {};
      SYNC_KEYS.forEach(function (key) {
        if (key in config) update[key] = config[key];
      });
      chrome.storage.sync.set(update);
    } catch (e) {
      /* ignore */
    }
  });

  // ─── Blocked cards sync (chrome.storage.local ↔ localStorage) ───

  function syncBlockedToLocal() {
    chrome.storage.local.get({ le_blocked_cards: "[]" }, function (data) {
      try {
        localStorage.setItem(BLOCKED_KEY, data.le_blocked_cards || "[]");
      } catch (e) {
        /* ignore */
      }
      try {
        document.dispatchEvent(new CustomEvent("le-blocked-changed"));
      } catch (e) {
        /* ignore */
      }
    });
  }

  syncBlockedToLocal();

  document.addEventListener("le-blocked-save", function () {
    try {
      var value = localStorage.getItem(BLOCKED_KEY) || "[]";
      chrome.storage.local.set({ le_blocked_cards: value });
    } catch (e) {
      /* ignore */
    }
  });

  // ─── Blocked images sync (chrome.storage.local ↔ localStorage) ───

  function syncBlockedImgsToLocal() {
    chrome.storage.local.get({ le_blocked_imgs: "{}" }, function (data) {
      try {
        localStorage.setItem(IMGS_KEY, data.le_blocked_imgs || "{}");
      } catch (e) {
        /* ignore */
      }
    });
  }

  syncBlockedImgsToLocal();

  document.addEventListener("le-blocked-imgs-save", function () {
    try {
      var value = localStorage.getItem(IMGS_KEY) || "{}";
      chrome.storage.local.set({ le_blocked_imgs: value });
    } catch (e) {
      /* ignore */
    }
  });

  // ─── Listen for storage changes ───

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "sync") syncConfigToLocal();
    if (area === "local" && changes.le_blocked_cards) syncBlockedToLocal();
    if (area === "local" && changes.le_blocked_imgs) syncBlockedImgsToLocal();
  });
})();
