// Liga Enhanced - EDC Filter Module
// Filters for edition/set card grid pages (edc object)
(function () {
  "use strict";

  const LE = window.LigaEnhanced;
  if (!LE) return;

  const ui = LE.ui;
  const C = LE.constants;

  let allCards = [];
  let filteredCards = [];
  let activeFilters = { search: "", iR: [], iC: [], iT: [], sA: [], iCMC: [] };
  let filtersConfig = {};

  // ─── Detection ───

  function findCards() {
    if (typeof edc === "undefined") return null;
    const props = ["obj", "allCards", "cards", "cardsAll", "data"];
    for (const prop of props) {
      const val = edc[prop];
      if (
        Array.isArray(val) &&
        val.length > 0 &&
        val[0] &&
        typeof val[0].id === "number"
      )
        return val;
    }
    for (const key of Object.keys(edc)) {
      const val = edc[key];
      if (
        Array.isArray(val) &&
        val.length > 0 &&
        val[0] &&
        typeof val[0].nEN === "string"
      )
        return val;
    }
    return null;
  }

  function canHandle() {
    return findCards() && document.querySelector(".grid-cardsinput");
  }

  // ─── Filter State ───

  function hasActive() {
    return (
      activeFilters.search ||
      activeFilters.iR.length > 0 ||
      activeFilters.iC.length > 0 ||
      activeFilters.iT.length > 0 ||
      activeFilters.sA.length > 0 ||
      activeFilters.iCMC.length > 0
    );
  }

  function toggleArrayFilter(key, val) {
    const arr = activeFilters[key];
    const idx = arr.indexOf(val);
    if (idx === -1) arr.push(val);
    else arr.splice(idx, 1);
  }

  // ─── Extract Filter Options ───

  function uniqueValues(field) {
    return [
      ...new Set(
        allCards
          .map((c) => c[field])
          .filter((v) => v !== undefined && v !== null),
      ),
    ];
  }

  function uniqueStrings(field) {
    return [
      ...new Set(allCards.map((c) => c[field]).filter((v) => v && v.trim())),
    ].sort();
  }

  function extractFilterOptions() {
    filtersConfig = {};
    const rVals = uniqueValues("iR");
    if (rVals.length > 0)
      filtersConfig.iR = {
        label: "Raridade",
        field: "iR",
        options: rVals.map((v) => ({
          id: v,
          label: C.RARITY_MAP[v] || "R" + v,
          count: allCards.filter((c) => c.iR === v).length,
        })),
      };
    const cVals = uniqueValues("iC");
    if (cVals.length > 0)
      filtersConfig.iC = {
        label: "Cor",
        field: "iC",
        options: cVals.map((v) => ({
          id: v,
          label: C.COLOR_MAP[v] || "C" + v,
          count: allCards.filter((c) => c.iC === v).length,
          color: C.COLOR_HEX[v],
        })),
      };
    const tVals = uniqueValues("iT");
    if (tVals.length > 0)
      filtersConfig.iT = {
        label: "Tipo",
        field: "iT",
        options: tVals.map((v) => ({
          id: v,
          label: C.TYPE_MAP[v] || "T" + v,
          count: allCards.filter((c) => c.iT === v).length,
        })),
      };
    const cmcVals = uniqueValues("iCMC");
    if (cmcVals.length > 0)
      filtersConfig.iCMC = {
        label: "Custo de Mana",
        field: "iCMC",
        values: cmcVals.sort((a, b) => a - b),
        counts: Object.fromEntries(
          cmcVals.map((v) => [v, allCards.filter((c) => c.iCMC === v).length]),
        ),
      };
    const aVals = uniqueStrings("sA");
    if (aVals.length > 0)
      filtersConfig.sA = {
        label: "Artista",
        field: "sA",
        options: aVals.map((v) => ({
          id: v,
          label: v,
          count: allCards.filter((c) => c.sA === v).length,
        })),
      };
  }

  // ─── Build Panel HTML ───

  function buildHTML() {
    let html =
      '<div class="le-section"><input type="text" id="le-search" class="le-input" placeholder="Buscar por nome..." autocomplete="off"></div>';
    html +=
      '<div id="le-active-bar" class="le-active-bar" style="display:none;"></div>';
    html +=
      '<div class="le-results-bar"><span id="le-results-count">' +
      allCards.length +
      "</span> / " +
      allCards.length +
      ' cards <button id="le-clear-all" class="le-clear-btn" style="display:none;">Limpar</button></div>';

    for (const key of ["iR", "iC", "iT"]) {
      if (filtersConfig[key])
        html += ui.buildChipSection(key, filtersConfig[key]);
    }

    if (filtersConfig.iCMC) {
      const cmc = filtersConfig.iCMC;
      html +=
        '<div class="le-section" data-key="iCMC"><div class="le-section-title">' +
        cmc.label +
        ' <span class="le-section-badge" id="le-badge-iCMC"></span></div><div class="le-mana-row">';
      for (const v of cmc.values)
        html +=
          '<button class="le-mana-btn" data-key="iCMC" data-val="' +
          v +
          '"><span class="le-mana-circle">' +
          v +
          '</span><span class="le-mana-qty">' +
          (cmc.counts[v] || 0) +
          "</span></button>";
      html += "</div></div>";
    }

    if (filtersConfig.sA) {
      const sa = filtersConfig.sA;
      html +=
        '<div class="le-section" data-key="sA"><div class="le-section-title">' +
        sa.label +
        ' <span class="le-section-badge" id="le-badge-sA"></span></div>';
      html +=
        '<input type="text" class="le-input le-input-sm le-list-search" data-list="le-artist-list" placeholder="Buscar artista..." autocomplete="off">';
      html += '<div class="le-artist-list" id="le-artist-list">';
      for (const opt of sa.options) {
        const esc = opt.id.replace(/"/g, "&quot;");
        html +=
          '<label class="le-artist-row" data-name="' +
          esc +
          '"><input type="checkbox" class="le-cb" data-key="sA" data-val="' +
          esc +
          '"><span class="le-artist-name">' +
          opt.label +
          '</span><span class="le-artist-qty">' +
          opt.count +
          "</span></label>";
      }
      html += "</div></div>";
    }

    return html;
  }

  // ─── Bind Events ───

  function bindEvents(panel) {
    let timer;
    panel.querySelector("#le-search").addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(() => {
        activeFilters.search = this.value.trim().toLowerCase();
        applyFilters();
      }, 200);
    });

    panel.querySelectorAll(".le-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        toggleArrayFilter(chip.dataset.key, parseInt(chip.dataset.val, 10));
        chip.classList.toggle("le-chip-on");
        applyFilters();
      });
    });

    panel.querySelectorAll(".le-mana-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleArrayFilter("iCMC", parseInt(btn.dataset.val, 10));
        btn.classList.toggle("le-mana-on");
        applyFilters();
      });
    });

    panel.querySelectorAll('.le-cb[data-key="sA"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const val = cb.dataset.val;
        if (cb.checked) {
          if (!activeFilters.sA.includes(val)) activeFilters.sA.push(val);
        } else {
          activeFilters.sA = activeFilters.sA.filter((v) => v !== val);
        }
        ui.reorderList(null, "le-artist-list");
        applyFilters();
      });
    });

    ui.bindListSearch(panel);

    panel.querySelector("#le-clear-all").addEventListener("click", clearAll);
  }

  // ─── Clear ───

  function clearAll() {
    activeFilters = { search: "", iR: [], iC: [], iT: [], sA: [], iCMC: [] };
    const panel = document.getElementById("le-panel");
    if (!panel) return;
    panel.querySelector("#le-search").value = "";
    panel
      .querySelectorAll(".le-chip-on")
      .forEach((c) => c.classList.remove("le-chip-on"));
    panel
      .querySelectorAll(".le-mana-on")
      .forEach((c) => c.classList.remove("le-mana-on"));
    panel.querySelectorAll(".le-cb").forEach((c) => {
      c.checked = false;
    });
    filteredCards = [...allCards];
    unlockOriginalFilters();
    updateGrid();
    updateCounts();
    updateActiveBar();
  }

  // ─── Apply Filters ───

  function applyFilters() {
    const search = activeFilters.search;
    filteredCards = allCards.filter((card) => {
      if (search) {
        const nEN = (card.nEN || "").toLowerCase();
        const nPT = (card.nPT || "").toLowerCase();
        const sT = (card.sT || "").toLowerCase();
        if (
          !nEN.includes(search) &&
          !nPT.includes(search) &&
          !sT.includes(search)
        )
          return false;
      }
      for (const key of ["iR", "iC", "iT", "iCMC"]) {
        if (
          activeFilters[key].length > 0 &&
          !activeFilters[key].includes(card[key])
        )
          return false;
      }
      if (activeFilters.sA.length > 0 && !activeFilters.sA.includes(card.sA))
        return false;
      return true;
    });
    updateGrid();
    updateCounts();
    updateActiveBar();
    if (hasActive()) lockOriginalFilters();
    else unlockOriginalFilters();
  }

  function updateGrid() {
    if (typeof edc === "undefined") return;
    edc.obj = filteredCards;
    try {
      if (typeof edc.reloadExec === "function") edc.reloadExec();
      else if (typeof edc.reload === "function") edc.reload();
    } catch (e) {
      /* ignore */
    }
  }

  function lockOriginalFilters() {
    const el = document.getElementById("card-esquerda");
    if (el && hasActive()) {
      el.style.pointerEvents = "none";
      el.style.opacity = "0.5";
    }
  }

  function unlockOriginalFilters() {
    const el = document.getElementById("card-esquerda");
    if (el) {
      el.style.pointerEvents = "";
      el.style.opacity = "";
    }
  }

  // ─── Update Counts (cross-filter) ───

  function updateCounts() {
    const countEl = document.getElementById("le-results-count");
    if (countEl) countEl.textContent = filteredCards.length;
    const panel = document.getElementById("le-panel");
    if (!panel) return;

    const filterKeys = ["iR", "iC", "iT", "iCMC", "sA"];
    for (const key of filterKeys) {
      if (!filtersConfig[key]) continue;
      const others = allCards.filter((card) => {
        const search = activeFilters.search;
        if (search) {
          const nEN = (card.nEN || "").toLowerCase();
          const nPT = (card.nPT || "").toLowerCase();
          const sT = (card.sT || "").toLowerCase();
          if (
            !nEN.includes(search) &&
            !nPT.includes(search) &&
            !sT.includes(search)
          )
            return false;
        }
        for (const ok of filterKeys) {
          if (ok === key) continue;
          if (
            activeFilters[ok].length > 0 &&
            !activeFilters[ok].includes(card[ok])
          )
            return false;
        }
        return true;
      });

      if (key === "iCMC") {
        panel.querySelectorAll(".le-mana-btn").forEach((btn) => {
          const val = parseInt(btn.dataset.val, 10);
          const count = others.filter((c) => c.iCMC === val).length;
          btn.querySelector(".le-mana-qty").textContent = count;
          btn.classList.toggle(
            "le-mana-zero",
            count === 0 && !btn.classList.contains("le-mana-on"),
          );
        });
      } else if (key === "sA") {
        const list = document.getElementById("le-artist-list");
        const rows = list
          ? Array.from(list.querySelectorAll(".le-artist-row"))
          : [];
        rows.forEach((row) => {
          const val = row.dataset.name;
          const count = others.filter((c) => c.sA === val).length;
          row.querySelector(".le-artist-qty").textContent = count;
          row.classList.toggle("le-artist-zero", count === 0);
          row._count = count;
        });
        if (list && hasActive()) {
          rows.sort((a, b) => {
            const ac = a.querySelector('input[type="checkbox"]')?.checked
              ? 0
              : 1;
            const bc = b.querySelector('input[type="checkbox"]')?.checked
              ? 0
              : 1;
            if (ac !== bc) return ac - bc;
            return (a._count > 0 ? 0 : 1) - (b._count > 0 ? 0 : 1);
          });
          for (const row of rows) list.appendChild(row);
        }
      } else {
        panel
          .querySelectorAll('.le-chip[data-key="' + key + '"]')
          .forEach((chip) => {
            const val = parseInt(chip.dataset.val, 10);
            const count = others.filter((c) => c[key] === val).length;
            chip.querySelector(".le-chip-qty").textContent = count;
            chip.classList.toggle(
              "le-chip-zero",
              count === 0 && !chip.classList.contains("le-chip-on"),
            );
          });
      }
      const badge = document.getElementById("le-badge-" + key);
      if (badge) {
        const n = activeFilters[key].length;
        badge.textContent = n > 0 ? n : "";
      }
    }
    const clearBtn = document.getElementById("le-clear-all");
    if (clearBtn)
      clearBtn.style.display = hasActive() ? "inline-block" : "none";
  }

  // ─── Active Filter Bar ───

  function updateActiveBar() {
    const bar = document.getElementById("le-active-bar");
    if (!bar) return;
    const tags = [];
    if (activeFilters.search)
      tags.push({
        key: "search",
        val: activeFilters.search,
        label: '"' + activeFilters.search + '"',
      });
    for (const key of ["iR", "iC", "iT", "iCMC", "sA"]) {
      for (const val of activeFilters[key]) {
        let label;
        if (key === "sA") label = val;
        else if (key === "iR") label = C.RARITY_MAP[val] || val;
        else if (key === "iC") label = C.COLOR_MAP[val] || val;
        else if (key === "iT") label = C.TYPE_MAP[val] || val;
        else label = "CMC " + val;
        tags.push({ key, val, label });
      }
    }
    if (!tags.length) {
      bar.style.display = "none";
      bar.innerHTML = "";
      return;
    }
    bar.style.display = "flex";
    bar.innerHTML = tags
      .map((t) => {
        const v = String(t.val).replace(/"/g, "&quot;");
        return (
          '<span class="le-tag" data-key="' +
          t.key +
          '" data-val="' +
          v +
          '">' +
          t.label +
          " &times;</span>"
        );
      })
      .join("");
    bar.querySelectorAll(".le-tag").forEach((tag) => {
      tag.addEventListener("click", () => {
        const k = tag.dataset.key,
          v = tag.dataset.val;
        if (k === "search") {
          activeFilters.search = "";
          document.getElementById("le-search").value = "";
        } else if (k === "sA") {
          activeFilters.sA = activeFilters.sA.filter((x) => x !== v);
          const cb = document.querySelector(
            '#le-panel .le-cb[data-val="' + v.replace(/"/g, '\\"') + '"]',
          );
          if (cb) cb.checked = false;
          ui.reorderList(null, "le-artist-list");
        } else if (k === "iCMC") {
          const n = parseInt(v, 10);
          activeFilters.iCMC = activeFilters.iCMC.filter((x) => x !== n);
          const btn = document.querySelector(
            '#le-panel .le-mana-btn[data-val="' + n + '"]',
          );
          if (btn) btn.classList.remove("le-mana-on");
        } else {
          const n = parseInt(v, 10);
          activeFilters[k] = activeFilters[k].filter((x) => x !== n);
          const chip = document.querySelector(
            '#le-panel .le-chip[data-key="' + k + '"][data-val="' + n + '"]',
          );
          if (chip) chip.classList.remove("le-chip-on");
        }
        applyFilters();
      });
    });
  }

  // ─── Register Module ───

  LE.registerModule({
    name: "edc",
    canHandle: canHandle,
    init: function () {
      const cards = findCards();
      if (!cards) return;
      allCards = [...cards];
      filteredCards = [...cards];
      extractFilterOptions();
      ui.createFloatingButton();
      const panel = ui.createPanelShell(buildHTML());
      bindEvents(panel);
    },
  });
})();
