// Liga Enhanced - Filter Core
// Shared UI components, module registry, and bootstrap logic
(function () {
  'use strict';

  window.LigaEnhanced = window.LigaEnhanced || {};

  // ─── Module Registry ───

  const modules = [];

  window.LigaEnhanced.registerModule = function (module) {
    modules.push(module);
  };

  // ─── Shared Panel State ───

  let panelOpen = false;

  function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById('le-panel').classList.toggle('le-panel-open', panelOpen);
    document.getElementById('le-backdrop').classList.toggle('le-backdrop-show', panelOpen);
    document.getElementById('le-fab').classList.toggle('le-fab-active', panelOpen);
  }

  function createFloatingButton() {
    if (document.getElementById('le-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'le-fab';
    fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>';
    fab.title = 'Filtros Avançados';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  function createPanelShell(bodyHTML) {
    if (!document.getElementById('le-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'le-backdrop';
      backdrop.addEventListener('click', togglePanel);
      document.body.appendChild(backdrop);
    }

    let panel = document.getElementById('le-panel');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'le-panel';
    panel.innerHTML = '<div class="le-panel-header"><h2>Filtros</h2><button id="le-panel-close">&times;</button></div>' +
      '<div class="le-panel-body">' + bodyHTML + '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#le-panel-close').addEventListener('click', togglePanel);
    return panel;
  }

  // ─── Shared HTML Builders ───

  function buildChipSection(key, cfg) {
    const C = window.LigaEnhanced.constants;
    let html = '<div class="le-section" data-key="' + key + '">';
    html += '<div class="le-section-title">' + cfg.label + ' <span class="le-section-badge" id="le-badge-' + key + '"></span></div>';
    html += '<div class="le-chips" id="le-chips-' + key + '">';

    for (const opt of cfg.options) {
      let icon = '';
      if (key === 'iC' && C.COLOR_ICON[opt.id]) {
        icon = C.COLOR_ICON[opt.id];
      } else if (opt.color) {
        icon = '<span class="le-dot" style="background:' + opt.color + '"></span>';
      }
      const qtyHtml = cfg.hideCount ? '' : '<span class="le-chip-qty">' + (opt.count || 0) + '</span>';
      html += '<button class="le-chip" data-key="' + key + '" data-val="' + opt.id + '">' + icon + '<span class="le-chip-text">' + opt.label + '</span>' + qtyHtml + '</button>';
    }

    html += '</div></div>';
    return html;
  }

  function buildSearchableList(key, cfg) {
    let html = '<div class="le-section" data-key="' + key + '">';
    html += '<div class="le-section-title">' + cfg.label + ' <span class="le-section-badge" id="le-badge-' + key + '"></span></div>';
    html += '<input type="text" class="le-input le-input-sm le-list-search" data-list="le-list-' + key + '" placeholder="Buscar ' + cfg.label.toLowerCase() + '..." autocomplete="off">';
    html += '<div class="le-artist-list" id="le-list-' + key + '">';
    for (const opt of cfg.options) {
      const esc = String(opt.id).replace(/"/g, '&quot;');
      html += '<label class="le-artist-row" data-name="' + opt.label.replace(/"/g, '&quot;') + '"><input type="checkbox" class="le-cb" data-key="' + key + '" data-val="' + esc + '"><span class="le-artist-name">' + opt.label + '</span><span class="le-artist-qty">' + opt.count + '</span></label>';
    }
    html += '</div></div>';
    return html;
  }

  function reorderList(key, listId) {
    const list = document.getElementById(listId || ('le-list-' + key));
    if (!list) return;
    const rows = Array.from(list.children);
    rows.sort((a, b) => {
      const aOn = a.querySelector('input[type="checkbox"]')?.checked ? 0 : 1;
      const bOn = b.querySelector('input[type="checkbox"]')?.checked ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      const aName = (a.dataset.name || '').toLowerCase();
      const bName = (b.dataset.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });
    for (const row of rows) list.appendChild(row);
  }

  // ─── Shared List Search Binding ───

  function bindListSearch(panel) {
    panel.querySelectorAll('.le-list-search').forEach(function (input) {
      input.addEventListener('input', function () {
        var list = document.getElementById(input.dataset.list);
        if (!list) return;
        var q = input.value.trim().toLowerCase();
        list.querySelectorAll('.le-artist-row').forEach(function (row) {
          row.style.display = (!q || row.dataset.name.toLowerCase().includes(q)) ? '' : 'none';
        });
      });
    });
  }

  // ─── Shared Native Delegation Helpers (bzr/showcase) ───

  function syncNativeState(chipSelector, cbSelector) {
    var panel = document.getElementById('le-panel');
    if (!panel) return;
    panel.querySelectorAll(chipSelector).forEach(function (chip) {
      var nativeCb = document.getElementById(chip.dataset.nativeId);
      if (nativeCb) chip.classList.toggle('le-chip-on', nativeCb.checked);
    });
    panel.querySelectorAll(cbSelector).forEach(function (cb) {
      var nativeCb = document.getElementById(cb.dataset.nativeId);
      if (nativeCb) cb.checked = nativeCb.checked;
    });
    panel.querySelectorAll('.le-artist-list').forEach(function (list) {
      reorderList(null, list.id);
    });
  }

  function updateNativeClearButton(filterGroups, extraCheckFn) {
    var hasActive = extraCheckFn ? extraCheckFn() : false;
    for (var i = 0; i < filterGroups.length && !hasActive; i++) {
      for (var j = 0; j < filterGroups[i].options.length && !hasActive; j++) {
        var cb = document.getElementById(filterGroups[i].options[j].cbId);
        if (cb && cb.checked) hasActive = true;
      }
    }
    var clearBtn = document.getElementById('le-clear-all');
    if (clearBtn) clearBtn.style.display = hasActive ? 'inline-block' : 'none';
  }

  // ─── Expose Shared UI ───

  window.LigaEnhanced.ui = {
    createFloatingButton: createFloatingButton,
    createPanelShell: createPanelShell,
    togglePanel: togglePanel,
    buildChipSection: buildChipSection,
    buildSearchableList: buildSearchableList,
    reorderList: reorderList,
    bindListSearch: bindListSearch,
    syncNativeState: syncNativeState,
    updateNativeClearButton: updateNativeClearButton
  };

  // ─── Bootstrap ───

  function waitForReady() {
    const max = 100;
    let attempts = 0;

    const check = () => {
      attempts++;
      for (const mod of modules) {
        try {
          if (mod.canHandle()) {
            try { mod.init(); } catch (e) { /* ignore */ }
            return;
          }
        } catch (e) { /* ignore */ }
      }
      if (attempts < max) setTimeout(check, 200);
    };

    check();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForReady);
  } else {
    waitForReady();
  }
})();
