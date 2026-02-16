// Liga Enhanced - Showcase Filter Module
// UI wrapper for store showcase/vitrine pages — delegates filtering to native showcase system (server-side)
(function () {
  "use strict";

  var LE = window.LigaEnhanced;
  if (!LE) return;

  var ui = LE.ui;
  var C = LE.constants;

  // ─── State ───

  var filterGroups = [];

  var QUALITY_LABELS = C.QUALITY_LABELS;

  // ─── Detection ───

  function canHandle() {
    return (
      typeof showcase !== "undefined" &&
      !!document.querySelector(".screenfilter-list-filters")
    );
  }

  // ─── Parse Native Sidebar Filters ───

  function parseFilterGroups() {
    var groups = [];
    var container =
      document.querySelector(".container-filter.screenfilter-list-filters") ||
      document.querySelector(".screenfilter-list-filters");
    if (!container) return groups;

    container.querySelectorAll(".group-filter").forEach(function (section) {
      // Group index from id="group-0", "group-1", etc.
      var idMatch = (section.id || "").match(/^group-(\d+)$/);
      if (!idMatch) return;
      var groupIdx = parseInt(idMatch[1]);

      var titleEl = section.querySelector(".filter-header .title");
      var title = titleEl
        ? titleEl.getAttribute("data-label") ||
          titleEl.textContent.trim().replace(/^\d+\s*/, "")
        : "Grupo " + groupIdx;

      // Get filter type from the clear button onclick (.clean-filter)
      var filterType = "";
      var clearEl = section.querySelector(".clean-filter");
      if (clearEl) {
        var m = (clearEl.getAttribute("onclick") || "").match(
          /filtersClear\(\s*\d+\s*,\s*'([^']+)'\s*\)/,
        );
        if (m) filterType = m[1];
      }

      var countEl = section.querySelector(".filter-generalcount");

      var options = [];
      section.querySelectorAll(".filter-option").forEach(function (optEl) {
        var cb = optEl.querySelector('input[type="checkbox"]');
        if (!cb) return;

        // Extract optionIndex and value from onclick
        var onclick = cb.getAttribute("onclick") || "";
        var searchMatch = onclick.match(
          /showcase\.search\(this\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/,
        );
        if (!searchMatch) return;

        var optIdx = parseInt(searchMatch[2]);
        var type = searchMatch[3];
        var value = searchMatch[4];

        // Label from span
        var labelEl = optEl.querySelector("span");
        var rawLabel = labelEl
          ? labelEl.textContent.trim()
          : "Option " + optIdx;

        // Override quality labels only for card quality (has abbreviations like "(M)", "(NM)")
        if (
          type === "quality" &&
          QUALITY_LABELS[parseInt(value)] &&
          /\([MNHSPD]+\)/.test(rawLabel)
        ) {
          rawLabel = QUALITY_LABELS[parseInt(value)];
        }

        var icon = "";
        if (type === "color" && C.COLOR_ICON[parseInt(value)]) {
          icon = C.COLOR_ICON[parseInt(value)];
        }

        // Hidden state (behind "show more")
        var hidden = optEl.classList.contains("filter-hide-limit");

        options.push({
          cbId: cb.id,
          optIdx: optIdx,
          type: type,
          value: value,
          label: rawLabel,
          icon: icon,
          hidden: hidden,
        });
      });

      var hasSearch = !!section.querySelector(".filter-by-text");

      if (options.length > 0) {
        groups.push({
          title: title,
          groupIdx: groupIdx,
          filterType: filterType,
          countElId: countEl ? countEl.id : null,
          options: options,
          hasSearch: hasSearch,
        });
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

    for (var i = 0; i < filterGroups.length; i++) {
      var group = filterGroups[i];
      var isSearchable = group.hasSearch || group.options.length > 15;

      if (isSearchable) {
        html += '<div class="le-section">';
        html += '<div class="le-section-title">' + group.title + "</div>";
        html +=
          '<input type="text" class="le-input le-input-sm le-list-search" data-list="le-sc-list-' +
          group.groupIdx +
          '" placeholder="Buscar ' +
          group.title.toLowerCase() +
          '..." autocomplete="off">';
        html +=
          '<div class="le-artist-list" id="le-sc-list-' + group.groupIdx + '">';
        for (var j = 0; j < group.options.length; j++) {
          var opt = group.options[j];
          var nativeCb = document.getElementById(opt.cbId);
          var checked = nativeCb && nativeCb.checked;
          html +=
            '<label class="le-artist-row" data-name="' +
            opt.label.replace(/"/g, "&quot;") +
            '">';
          html +=
            '<input type="checkbox" class="le-cb le-sc-cb" data-native-id="' +
            opt.cbId +
            '" data-group="' +
            group.groupIdx +
            '" data-opt="' +
            opt.optIdx +
            '" data-type="' +
            opt.type +
            '" data-value="' +
            opt.value +
            '"' +
            (checked ? " checked" : "") +
            ">";
          html += '<span class="le-artist-name">' + opt.label + "</span>";
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
          var cls = "le-chip le-sc-chip" + (checked ? " le-chip-on" : "");
          html +=
            '<button class="' +
            cls +
            '" data-native-id="' +
            opt.cbId +
            '" data-group="' +
            group.groupIdx +
            '" data-opt="' +
            opt.optIdx +
            '" data-type="' +
            opt.type +
            '" data-value="' +
            opt.value +
            '">';
          if (opt.icon) html += opt.icon;
          html += '<span class="le-chip-text">' + opt.label + "</span>";
          html += "</button>";
        }
        html += "</div></div>";
      }
    }

    return html;
  }

  // ─── Bind Events ───

  function bindEvents(panel) {
    // Chip clicks → toggle native checkbox → showcase.search
    panel.querySelectorAll(".le-sc-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var nativeId = chip.dataset.nativeId;
        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = !nativeCb.checked;
        chip.classList.toggle("le-chip-on", nativeCb.checked);
        showcase.search(
          nativeCb,
          parseInt(chip.dataset.group),
          parseInt(chip.dataset.opt),
          chip.dataset.type,
          chip.dataset.value,
        );
        refreshActiveUI();
      });
    });

    // List checkboxes → toggle native → showcase.search
    panel.querySelectorAll(".le-sc-cb").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var nativeId = cb.dataset.nativeId;
        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = cb.checked;
        showcase.search(
          nativeCb,
          parseInt(cb.dataset.group),
          parseInt(cb.dataset.opt),
          cb.dataset.type,
          cb.dataset.value,
        );
        var listEl = cb.closest(".le-artist-list");
        if (listEl) ui.reorderList(null, listEl.id);
        refreshActiveUI();
      });
    });

    ui.bindListSearch(panel);

    var clearBtn = panel.querySelector("#le-clear-all");
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
  }

  // ─── Clear All ───

  function clearAll() {
    filterGroups.forEach(function (group) {
      var hasChecked = group.options.some(function (opt) {
        var cb = document.getElementById(opt.cbId);
        return cb && cb.checked;
      });
      if (hasChecked && group.filterType) {
        showcase.filtersClear(group.groupIdx, group.filterType);
      }
    });
    syncAllFromNative();
    refreshActiveUI();
  }

  function syncAllFromNative() {
    ui.syncNativeState(".le-sc-chip", ".le-sc-cb");
  }

  // ─── Active UI ───

  function refreshActiveUI() {
    updateActiveBar();
    updateClearButton();
  }

  function updateClearButton() {
    ui.updateNativeClearButton(filterGroups);
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
          tags.push({
            cbId: opt.cbId,
            label: opt.label,
            groupIdx: group.groupIdx,
            optIdx: opt.optIdx,
            type: opt.type,
            value: opt.value,
          });
        }
      }
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
          '" data-group="' +
          t.groupIdx +
          '" data-opt="' +
          t.optIdx +
          '" data-type="' +
          t.type +
          '" data-value="' +
          t.value +
          '">' +
          t.label +
          " &times;</span>"
        );
      })
      .join("");

    bar.querySelectorAll(".le-tag").forEach(function (tag) {
      tag.addEventListener("click", function () {
        var nativeId = tag.dataset.nativeId;
        var nativeCb = document.getElementById(nativeId);
        if (!nativeCb) return;
        nativeCb.checked = false;
        showcase.search(
          nativeCb,
          parseInt(tag.dataset.group),
          parseInt(tag.dataset.opt),
          tag.dataset.type,
          tag.dataset.value,
        );

        var panel = document.getElementById("le-panel");
        if (panel) {
          var chip = panel.querySelector(
            '.le-sc-chip[data-native-id="' + nativeId + '"]',
          );
          if (chip) chip.classList.remove("le-chip-on");
          var cb = panel.querySelector(
            '.le-sc-cb[data-native-id="' + nativeId + '"]',
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

  // ─── Hook Native Showcase Methods ───

  function hookShowcase() {
    // Hook search to sync when native sidebar checkboxes are used directly
    if (typeof showcase.search === "function") {
      var origSearch = showcase.search;
      showcase.search = function () {
        origSearch.apply(this, arguments);
        syncAllFromNative();
        refreshActiveUI();
      };
    }

    // Hook filtersClear to sync when native clear is clicked
    if (typeof showcase.filtersClear === "function") {
      var origClear = showcase.filtersClear;
      showcase.filtersClear = function () {
        origClear.apply(this, arguments);
        syncAllFromNative();
        refreshActiveUI();
      };
    }
  }

  // ─── Register Module ───

  LE.registerModule({
    name: "showcase",
    canHandle: canHandle,
    init: function () {
      filterGroups = parseFilterGroups();
      if (filterGroups.length === 0) return;

      hookShowcase();
      ui.createFloatingButton();
      var panel = ui.createPanelShell(buildHTML());
      bindEvents(panel);
      refreshActiveUI();
    },
  });
})();
