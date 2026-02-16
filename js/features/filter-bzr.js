// Liga Enhanced - BZR Filter Module
// UI wrapper for bazar seller pages — delegates filtering to native bzr system (server-side)
(function () {
  "use strict";

  var LE = window.LigaEnhanced;
  if (!LE) return;

  var ui = LE.ui;
  var C = LE.constants;

  // ─── State ───

  var filterGroups = [];
  var nameSearch = "";

  var QUALITY_LABELS = C.QUALITY_LABELS;

  // ─── Detection ───

  function canHandle() {
    return (
      typeof bzr !== "undefined" && !!document.getElementById("card-estoque")
    );
  }

  // ─── Parse Native Sidebar Filters ───

  function parseFilterGroups() {
    var groups = [];
    document.querySelectorAll(".filtro").forEach(function (section) {
      var titleEl = section.querySelector(".title b");
      if (!titleEl) return;
      var title = titleEl.textContent.trim();

      // Get groupKey from native "Limpar Filtros" onclick
      var clearEl = section.querySelector(".filtro-limpar");
      var groupKey = "";
      if (clearEl) {
        var m = (clearEl.getAttribute("onclick") || "").match(
          /removeFilters\('([^']+)'\)/,
        );
        if (m) groupKey = m[1];
      }

      var options = [];
      section.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        var labelEl = section.querySelector('label[for="' + cb.id + '"]');
        if (!labelEl) return;

        var countEl = labelEl.querySelector(".contador");
        var count = countEl
          ? parseInt(countEl.textContent.replace(/[()]/g, "")) || 0
          : 0;

        // Build display label (strip count prefix from native label)
        var rawLabel = labelEl.textContent.trim().replace(/^\(\d+\)\s*/, "");

        var qualMatch = cb.id.match(/^filtro_qualid_(\d+)$/);
        if (qualMatch && QUALITY_LABELS[qualMatch[1]]) {
          rawLabel = QUALITY_LABELS[qualMatch[1]];
        }

        var icon = "";
        var corMatch = cb.id.match(/^filtro_cor_(\d+)$/);
        if (corMatch && C.COLOR_ICON[parseInt(corMatch[1])]) {
          icon = C.COLOR_ICON[parseInt(corMatch[1])];
        }

        options.push({
          cbId: cb.id,
          label: rawLabel,
          count: count,
          icon: icon,
        });
      });

      if (options.length > 0) {
        groups.push({ title: title, groupKey: groupKey, options: options });
      }
    });
    return groups;
  }

  // ─── Build Panel HTML ───

  function buildHTML() {
    var html = "";
    html +=
      '<div id="le-active-bar" class="le-active-bar" style="display:none;"></div>';
    html +=
      '<div class="le-results-bar"><button id="le-clear-all" class="le-clear-btn" style="display:none;">Limpar Filtros</button></div>';

    // Name search (client-side show/hide on visible cards)
    html +=
      '<div class="le-section"><div class="le-section-title">Busca por Nome</div>';
    html +=
      '<input type="text" id="le-name-search" class="le-input le-input-sm" placeholder="Nome da carta..." autocomplete="off"></div>';

    for (var i = 0; i < filterGroups.length; i++) {
      var group = filterGroups[i];
      var isEditions = group.groupKey === "edicoes";

      if (isEditions) {
        html += '<div class="le-section">';
        html += '<div class="le-section-title">' + group.title + "</div>";
        html +=
          '<input type="text" class="le-input le-input-sm le-list-search" data-list="le-bzr-list-' +
          group.groupKey +
          '" placeholder="Buscar ' +
          group.title.toLowerCase() +
          '..." autocomplete="off">';
        html +=
          '<div class="le-artist-list" id="le-bzr-list-' +
          group.groupKey +
          '">';
        for (var j = 0; j < group.options.length; j++) {
          var opt = group.options[j];
          var nativeCb = document.getElementById(opt.cbId);
          var checked = nativeCb && nativeCb.checked;
          html +=
            '<label class="le-artist-row" data-name="' +
            opt.label.replace(/"/g, "&quot;") +
            '">';
          html +=
            '<input type="checkbox" class="le-cb le-bzr-cb" data-native-id="' +
            opt.cbId +
            '"' +
            (checked ? " checked" : "") +
            ">";
          html += '<span class="le-artist-name">' + opt.label + "</span>";
          html +=
            '<span class="le-artist-qty" id="le-qty-' +
            opt.cbId +
            '">' +
            opt.count +
            "</span>";
          html += "</label>";
        }
        html += "</div></div>";
      } else {
        html += '<div class="le-section">';
        html += '<div class="le-section-title">' + group.title + "</div>";
        html += '<div class="le-chips">';
        for (var j = 0; j < group.options.length; j++) {
          var opt = group.options[j];
          var nativeCb = document.getElementById(opt.cbId);
          var checked = nativeCb && nativeCb.checked;
          var cls =
            "le-chip le-bzr-chip" +
            (checked ? " le-chip-on" : "") +
            (opt.count === 0 ? " le-chip-zero" : "");
          html +=
            '<button class="' + cls + '" data-native-id="' + opt.cbId + '">';
          if (opt.icon) html += opt.icon;
          html += '<span class="le-chip-text">' + opt.label + "</span>";
          html +=
            '<span class="le-chip-qty" id="le-qty-' +
            opt.cbId +
            '">' +
            opt.count +
            "</span>";
          html += "</button>";
        }
        html += "</div></div>";
      }
    }

    return html;
  }

  // ─── Bind Events ───

  function bindEvents(panel) {
    // Chip clicks → toggle native checkbox → bzr.selectFilter
    panel.querySelectorAll(".le-bzr-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var nativeId = chip.dataset.nativeId;
        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = !nativeCb.checked;
        chip.classList.toggle("le-chip-on", nativeCb.checked);
        bzr.selectFilter(nativeCb);
        refreshActiveUI();
      });
    });

    // List checkboxes → toggle native → bzr.selectFilter
    panel.querySelectorAll(".le-bzr-cb").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var nativeId = cb.dataset.nativeId;
        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = cb.checked;
        bzr.selectFilter(nativeCb);
        var listEl = cb.closest(".le-artist-list");
        if (listEl) ui.reorderList(null, listEl.id);
        refreshActiveUI();
      });
    });

    ui.bindListSearch(panel);

    // Name search (client-side)
    var nameInput = panel.querySelector("#le-name-search");
    var nameTimer;
    if (nameInput) {
      nameInput.addEventListener("input", function () {
        clearTimeout(nameTimer);
        nameTimer = setTimeout(function () {
          nameSearch = nameInput.value.trim().toLowerCase();
          applyNameSearch();
          refreshActiveUI();
        }, 300);
      });
    }

    var clearBtn = panel.querySelector("#le-clear-all");
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
  }

  // ─── Name Search (client-side show/hide) ───

  function applyNameSearch() {
    var container = document.getElementById("card-estoque");
    if (!container) return;
    var cards = container.querySelectorAll('div[class*="uc_"]');
    cards.forEach(function (el) {
      if (!nameSearch) {
        // Don't override native filter visibility — only remove our hide
        if (el.dataset.leNameHidden) {
          el.style.display = "";
          delete el.dataset.leNameHidden;
        }
        return;
      }
      var mainEl = el.querySelector(".cardname-main");
      var auxEl = el.querySelector(".cardname-aux");
      var main = mainEl ? mainEl.textContent.trim().toLowerCase() : "";
      var aux = auxEl ? auxEl.textContent.trim().toLowerCase() : "";
      if (main.includes(nameSearch) || aux.includes(nameSearch)) {
        if (el.dataset.leNameHidden) {
          el.style.display = "";
          delete el.dataset.leNameHidden;
        }
      } else {
        el.style.display = "none";
        el.dataset.leNameHidden = "1";
      }
    });
  }

  // ─── Clear All ───

  function clearAll() {
    filterGroups.forEach(function (group) {
      if (!group.groupKey) return;
      var hasChecked = group.options.some(function (opt) {
        var cb = document.getElementById(opt.cbId);
        return cb && cb.checked;
      });
      if (hasChecked) bzr.removeFilters(group.groupKey);
    });
    nameSearch = "";
    var nameInput = document.getElementById("le-name-search");
    if (nameInput) nameInput.value = "";
    applyNameSearch();
    syncAllFromNative();
    refreshActiveUI();
  }

  function syncAllFromNative() {
    ui.syncNativeState(".le-bzr-chip", ".le-bzr-cb");
  }

  // ─── Active UI ───

  function refreshActiveUI() {
    updateActiveBar();
    updateClearButton();
  }

  function updateClearButton() {
    ui.updateNativeClearButton(filterGroups, function () {
      return nameSearch !== "";
    });
  }

  function updateActiveBar() {
    var bar = document.getElementById("le-active-bar");
    if (!bar) return;
    var tags = [];

    for (var i = 0; i < filterGroups.length; i++) {
      var group = filterGroups[i];
      for (var j = 0; j < group.options.length; j++) {
        var opt = group.options[j];
        var nativeCb = document.getElementById(opt.cbId);
        if (nativeCb && nativeCb.checked) {
          tags.push({ cbId: opt.cbId, label: opt.label });
        }
      }
    }

    if (nameSearch) {
      tags.push({ cbId: "_name_search", label: "Busca: " + nameSearch });
    }

    if (!tags.length) {
      bar.style.display = "none";
      bar.innerHTML = "";
      return;
    }
    bar.style.display = "flex";
    bar.innerHTML = tags
      .map(function (t) {
        return (
          '<span class="le-tag" data-native-id="' +
          t.cbId +
          '">' +
          t.label +
          " &times;</span>"
        );
      })
      .join("");

    bar.querySelectorAll(".le-tag").forEach(function (tag) {
      tag.addEventListener("click", function () {
        var nativeId = tag.dataset.nativeId;

        if (nativeId === "_name_search") {
          nameSearch = "";
          var nameInput = document.getElementById("le-name-search");
          if (nameInput) nameInput.value = "";
          applyNameSearch();
          refreshActiveUI();
          return;
        }

        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = false;
        bzr.selectFilter(nativeCb);

        var panel = document.getElementById("le-panel");
        if (panel) {
          var chip = panel.querySelector(
            '.le-bzr-chip[data-native-id="' + nativeId + '"]',
          );
          if (chip) chip.classList.remove("le-chip-on");
          var cb = panel.querySelector(
            '.le-bzr-cb[data-native-id="' + nativeId + '"]',
          );
          if (cb) {
            cb.checked = false;
            var listEl = cb.closest(".le-artist-list");
            if (listEl) ui.reorderList(null, listEl.id);
          }
        }
        refreshActiveUI();
      });
    });
  }

  // ─── Hook Native bzr Methods ───

  function hookBzr() {
    // Hook putFilter to update our panel counts when server responds
    if (typeof bzr.putFilter === "function") {
      var origPut = bzr.putFilter;
      bzr.putFilter = function (filterId, group, inputName, count, selected) {
        origPut.apply(this, arguments);
        var qtyEl = document.getElementById("le-qty-" + inputName);
        if (qtyEl) qtyEl.textContent = count;
        var chip = document.querySelector(
          '.le-bzr-chip[data-native-id="' + inputName + '"]',
        );
        if (chip)
          chip.classList.toggle(
            "le-chip-zero",
            count === 0 && !chip.classList.contains("le-chip-on"),
          );
        var listCb = document.querySelector(
          '.le-bzr-cb[data-native-id="' + inputName + '"]',
        );
        if (listCb) {
          var rowLabel = listCb.closest(".le-artist-row");
          if (rowLabel)
            rowLabel.classList.toggle("le-artist-zero", count === 0);
        }
      };
    }

    // Hook selectFilter to sync when native sidebar checkboxes are used directly
    if (typeof bzr.selectFilter === "function") {
      var origSelect = bzr.selectFilter;
      bzr.selectFilter = function () {
        origSelect.apply(this, arguments);
        syncAllFromNative();
        refreshActiveUI();
      };
    }

    // Hook removeFilters to sync when native "Limpar Filtros" is clicked
    if (typeof bzr.removeFilters === "function") {
      var origRemove = bzr.removeFilters;
      bzr.removeFilters = function () {
        origRemove.apply(this, arguments);
        syncAllFromNative();
        refreshActiveUI();
      };
    }
  }

  // ─── Register Module ───

  LE.registerModule({
    name: "bzr",
    canHandle: canHandle,
    init: function () {
      filterGroups = parseFilterGroups();
      if (filterGroups.length === 0) return;

      hookBzr();
      ui.createFloatingButton();
      var panel = ui.createPanelShell(buildHTML());
      bindEvents(panel);
      refreshActiveUI();
    },
  });
})();
