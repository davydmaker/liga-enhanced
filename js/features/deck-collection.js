// Liga Enhanced - Deck Collection Comparison
(function () {
  "use strict";

  var LE = window.LigaEnhanced;
  if (!LE) return;

  var CONFIG_KEY = "le_config";
  var CACHE_PREFIX = "le_col_";
  var CACHE_TTL = 3600000;
  var ITEMS_PER_PAGE = 80;

  // ─── State ───

  var _state = {
    deckCards: null,
    collectionCards: null,
    maps: null,
    config: null,
    collections: null,
    switching: false,
    listening: false,
  };

  // ─── Detection ───

  function canHandle() {
    return (
      !!document.getElementById("deck-header") &&
      !!document.getElementById("deck-view")
    );
  }

  // ─── Config ───

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveConfig(key, value) {
    _state.config[key] = value;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(_state.config));
    } catch (e) {
      /* ignore */
    }
    try {
      document.dispatchEvent(new CustomEvent("le-config-save"));
    } catch (e) {
      /* ignore */
    }
  }

  // ─── Name Normalization ───

  function normalizeName(str) {
    return str.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function extractCardNameFromUrl(href) {
    if (!href) return "";
    var match = href.match(/[?&]card=([^&]+)/);
    if (!match) return "";
    try {
      return normalizeName(decodeURIComponent(match[1]));
    } catch (e) {
      return normalizeName(match[1]);
    }
  }

  // ─── Parse Deck Cards from DOM ───

  function parseDeckCards() {
    var cards = [];
    var views = document.querySelectorAll('#deck-view > [id^="dk-val-"]');
    var activeView = null;

    for (var i = 0; i < views.length; i++) {
      if (
        views[i].querySelector(".pdeck-block") &&
        views[i].offsetParent !== null
      ) {
        activeView = views[i];
        break;
      }
    }
    if (!activeView) {
      for (var i = 0; i < views.length; i++) {
        if (views[i].querySelector(".pdeck-block")) {
          activeView = views[i];
          break;
        }
      }
    }
    if (!activeView) return cards;

    var section = "main";
    var lines = activeView.querySelectorAll(".deck-line");

    lines.forEach(function (line) {
      var typeEl = line.querySelector(".deck-type, .deck-type-first");
      if (typeEl) {
        var text = typeEl.textContent.trim().toLowerCase();
        if (text.indexOf("sideboard") !== -1) section = "side";
        else if (text.indexOf("maybe") !== -1) section = "maybe";
        return;
      }

      var cardLink = line.querySelector(".deck-card a");
      if (!cardLink) return;

      var nameAttr = cardLink.getAttribute("data-lc-name") || "";
      var nameText = cardLink.textContent.trim();
      var nameUrl = extractCardNameFromUrl(cardLink.getAttribute("href"));
      var name = nameAttr || nameText;

      var editionId = cardLink.getAttribute("data-ld-ed") || "";
      var qtyEl = line.querySelector(".deck-qty");
      var qty = qtyEl ? parseInt(qtyEl.textContent.trim()) || 1 : 1;

      var editionCode = "";
      var edImg = line.querySelector(".deck-edi img");
      if (edImg && edImg.title) {
        var match = edImg.title.match(/^\[([^\]]+)\]/);
        if (match) editionCode = match[1];
      }

      var names = [];
      if (nameAttr) names.push(normalizeName(nameAttr));
      if (nameText) names.push(normalizeName(nameText));
      if (nameUrl) names.push(nameUrl);
      var seen = {};
      names = names.filter(function (n) {
        if (!n || seen[n]) return false;
        seen[n] = true;
        return true;
      });

      cards.push({
        name: name,
        names: names,
        nameLower: normalizeName(name),
        editionId: editionId,
        editionCode: editionCode,
        qty: qty,
        section: section,
        element: line,
      });
    });

    return cards;
  }

  // ─── Fetch Collections List ───

  function fetchCollectionsList() {
    if (_state.collections) return Promise.resolve(_state.collections);

    return fetch("/?view=colecao/colecao")
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var blocks = doc.querySelectorAll(".blocos-colecao");
        var collections = [];

        blocks.forEach(function (block) {
          var nameLink = block.querySelector(".colecao-nome");
          if (!nameLink) return;

          var href = nameLink.getAttribute("href") || "";
          var idMatch = href.match(/[?&]id=(\d+)/);
          if (!idMatch) return;

          var countLink = block.querySelector("a.preto");
          var countText = countLink ? countLink.textContent.trim() : "";
          var count = parseInt(countText) || 0;

          collections.push({
            id: idMatch[1],
            name: nameLink.textContent.trim(),
            count: count,
          });
        });

        _state.collections = collections;
        return collections;
      })
      .catch(function () {
        return [];
      });
  }

  // ─── Fetch Collection Cards ───

  function fetchCollection(collectionId) {
    var cacheKey = CACHE_PREFIX + collectionId;
    try {
      var cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL) {
        return Promise.resolve(cached.cards);
      }
    } catch (e) {
      /* ignore */
    }

    return fetchCollectionPages(collectionId).then(function (cards) {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), cards: cards }),
        );
      } catch (e) {
        /* ignore */
      }
      return cards;
    });
  }

  function fetchCollectionPages(collectionId) {
    var baseUrl = "/?view=colecao/colecao&id=" + collectionId;

    return fetch(baseUrl)
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var cards = parseCollectionPage(doc);

        var pgAEl = doc.querySelector("#pgA");
        var total = pgAEl ? parseInt(pgAEl.value) || 0 : 0;

        if (total <= ITEMS_PER_PAGE) return cards;

        var totalPages = Math.ceil(total / ITEMS_PER_PAGE);
        var pgParams = extractPgParams(doc);
        var promises = [];

        for (var page = 2; page <= totalPages; page++) {
          promises.push(fetchSinglePage(baseUrl + pgParams + "&page=" + page));
        }

        return Promise.all(promises).then(function (pages) {
          pages.forEach(function (pageCards) {
            cards = cards.concat(pageCards);
          });
          return cards;
        });
      });
  }

  function fetchSinglePage(url) {
    return fetch(url)
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        return parseCollectionPage(doc);
      });
  }

  function extractPgParams(doc) {
    var params = "";
    ["pgA", "pgB", "pgC", "pgD", "pgE", "pgF", "pgG", "pgH"].forEach(
      function (field) {
        var el = doc.querySelector("#" + field);
        if (el && el.value)
          params += "&" + field + "=" + encodeURIComponent(el.value);
      },
    );
    return params;
  }

  // ─── Parse Collection Page HTML ───

  function parseCollectionPage(doc) {
    var cards = [];
    var table = doc.querySelector("#listacolecao");
    if (!table) return cards;

    table.querySelectorAll('tr[id^="cc_card_"]').forEach(function (row) {
      var idMatch = row.id.match(/^cc_card_(\d+)_(\d+)$/);
      if (!idMatch) return;

      var editionId = idMatch[2];

      var qtyEl = row.querySelector(".exibe_qtd_card_col");
      var qtyText = qtyEl ? qtyEl.textContent.trim() : "1x";
      var qty = parseInt(qtyText) || 1;

      var tooltipDiv = row.querySelector("[data-tooltip]");
      var namePT = "";
      var nameEN = "";
      var nameUrl = "";
      if (tooltipDiv) {
        var paragraphs = tooltipDiv.querySelectorAll("p");
        if (paragraphs.length >= 1) {
          var ptLink = paragraphs[0].querySelector("a");
          namePT = ptLink
            ? ptLink.textContent.trim()
            : paragraphs[0].textContent.trim();
          if (ptLink) {
            nameUrl = extractCardNameFromUrl(ptLink.getAttribute("href"));
          }
        }
        if (paragraphs.length >= 2) {
          var enLink = paragraphs[1].querySelector("a");
          nameEN = enLink
            ? enLink.textContent.trim()
            : paragraphs[1].textContent.trim();
          if (!nameUrl && enLink) {
            nameUrl = extractCardNameFromUrl(enLink.getAttribute("href"));
          }
        }
      }

      cards.push({
        editionId: editionId,
        qty: qty,
        namePT: normalizeName(namePT),
        nameEN: normalizeName(nameEN),
        nameUrl: nameUrl,
      });
    });

    return cards;
  }

  // ─── Build Lookup Maps ───

  function buildCollectionMaps(collectionCards) {
    var byName = {};
    var byNameEdition = {};

    function addToMaps(name, editionId, qty) {
      if (!name) return;
      byName[name] = (byName[name] || 0) + qty;
      var edKey = name + "\0" + editionId;
      byNameEdition[edKey] = (byNameEdition[edKey] || 0) + qty;
    }

    collectionCards.forEach(function (card) {
      var names = [];
      var seen = {};
      [card.namePT, card.nameEN, card.nameUrl].forEach(function (n) {
        if (n && !seen[n]) {
          seen[n] = true;
          names.push(n);
        }
      });

      names.forEach(function (name) {
        addToMaps(name, card.editionId, card.qty);
      });
    });

    return { byName: byName, byNameEdition: byNameEdition };
  }

  // ─── Compare Deck vs Collection ───

  function compare(deckCards, maps, mode, considerQty) {
    var results = [];

    deckCards.forEach(function (card) {
      var owned = 0;

      for (var i = 0; i < card.names.length; i++) {
        var n = card.names[i];
        if (mode === "name+edition" && card.editionId) {
          var edKey = n + "\0" + card.editionId;
          owned = maps.byNameEdition[edKey] || 0;
        } else {
          owned = maps.byName[n] || 0;
        }
        if (owned > 0) break;
      }

      var status;
      if (considerQty) {
        if (owned >= card.qty) status = "owned";
        else if (owned > 0) status = "partial";
        else status = "missing";
      } else {
        status = owned > 0 ? "owned" : "missing";
      }

      results.push({
        card: card,
        owned: owned,
        needed: card.qty,
        status: status,
      });
    });

    return results;
  }

  // ─── Apply Comparison ───

  function applyComparison() {
    if (!_state.deckCards || !_state.maps || !_state.config) return;

    var mode = _state.config.le_match_mode || "name";
    var considerQty = _state.config.le_consider_qty !== false;
    var results = compare(_state.deckCards, _state.maps, mode, considerQty);
    injectIndicators(results, _state.config);
  }

  // ─── Helpers ───

  function clearDots() {
    if (!_state.deckCards) return;
    _state.deckCards.forEach(function (card) {
      if (!card.element) return;
      var dot = card.element.querySelector(".le-col-dot");
      if (dot) dot.remove();
    });
  }

  function loadAndCompare(collectionId, collectionName) {
    if (_state.switching) return;
    _state.switching = true;

    saveConfig("le_collection_id", collectionId);
    saveConfig("le_collection_name", collectionName);
    clearDots();

    var existing = document.getElementById("le-col-banner");
    if (existing) existing.remove();

    var loadingBanner = document.createElement("div");
    loadingBanner.id = "le-col-banner";
    loadingBanner.className = "le-col-banner le-col-loading";
    loadingBanner.textContent = "Comparando com cole\u00e7\u00e3o...";
    insertBanner(loadingBanner);

    fetchCollection(collectionId)
      .then(function (collectionCards) {
        _state.collectionCards = collectionCards;
        _state.maps = buildCollectionMaps(collectionCards);
        _state.switching = false;
        applyComparison();
      })
      .catch(function () {
        _state.switching = false;
        var banner = document.getElementById("le-col-banner");
        if (banner) {
          banner.className = "le-col-banner le-col-error";
          banner.innerHTML = "<span>Erro ao carregar cole\u00e7\u00e3o</span>";
        }
      });
  }

  // ─── Start Banner ───

  function injectStartBanner() {
    var existing = document.getElementById("le-col-banner");
    if (existing) existing.remove();

    var banner = document.createElement("div");
    banner.id = "le-col-banner";
    banner.className = "le-col-banner";

    banner.innerHTML =
      '<div class="le-col-banner-info">' +
      '<span class="le-col-banner-title">Compara\u00e7\u00e3o com Cole\u00e7\u00e3o</span>' +
      '<span class="le-col-banner-stats">Compare as cartas do deck com sua cole\u00e7\u00e3o</span>' +
      "</div>" +
      '<button class="le-col-buy-btn" id="le-col-start-btn">Iniciar compara\u00e7\u00e3o</button>';

    insertBanner(banner);

    var startBtn = document.getElementById("le-col-start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        startComparison();
      });
    }
  }

  // ─── Selector Banner ───

  function injectSelectorBanner(selectedId) {
    var existing = document.getElementById("le-col-banner");
    if (existing) existing.remove();

    var banner = document.createElement("div");
    banner.id = "le-col-banner";
    banner.className = "le-col-banner";

    banner.innerHTML =
      '<div class="le-col-banner-info">' +
      '<div class="le-col-selector-row">' +
      '<span class="le-col-banner-title">Cole\u00e7\u00e3o:</span>' +
      '<select id="le-col-select" class="le-col-select" disabled>' +
      '<option value="">Carregando...</option>' +
      "</select>" +
      "</div>" +
      "</div>";

    insertBanner(banner);
    populateCollectionSelect(selectedId || "");

    var selectEl = document.getElementById("le-col-select");
    if (selectEl) {
      selectEl.addEventListener("change", function () {
        var opt = selectEl.options[selectEl.selectedIndex];
        var newId = selectEl.value;
        var newName =
          opt && newId ? opt.textContent.replace(/\s*\(\d+ cards\)$/, "") : "";
        if (newId) {
          loadAndCompare(newId, newName);
        } else {
          clearDots();
          saveConfig("le_collection_id", "");
          saveConfig("le_collection_name", "");
          _state.collectionCards = null;
          _state.maps = null;
          injectSelectorBanner("");
        }
      });
    }
  }

  // ─── Inject Visual Indicators ───

  function injectIndicators(results, config) {
    var considerQty = config.le_consider_qty !== false;
    var useEdition = config.le_match_mode === "name+edition";
    var totalCards = 0;
    var ownedCards = 0;
    var missingList = [];
    var hasPartial = false;

    results.forEach(function (r) {
      if (considerQty) {
        totalCards += r.needed;
        ownedCards += Math.min(r.owned, r.needed);
      } else {
        totalCards += 1;
        ownedCards += r.status === "owned" ? 1 : 0;
      }

      var line = r.card.element;
      if (!line) return;

      var existing = line.querySelector(".le-col-dot");
      if (existing) existing.remove();

      var dot = document.createElement("span");
      dot.className = "le-col-dot le-col-" + r.status;

      dot.title =
        r.status === "owned"
          ? "Possui na cole\u00e7\u00e3o (" + r.owned + " dispon\u00edvel)"
          : r.status === "partial"
            ? "Possui parcialmente: " + r.owned + " de " + r.needed
            : "N\u00e3o possui na cole\u00e7\u00e3o";

      if (r.status === "partial") hasPartial = true;

      var qtyEl = line.querySelector(".deck-qty");
      if (qtyEl) {
        qtyEl.parentNode.insertBefore(dot, qtyEl);
      } else {
        line.insertBefore(dot, line.firstChild);
      }

      if (r.status === "missing" || r.status === "partial") {
        var missingQty = considerQty
          ? r.needed - Math.min(r.owned, r.needed)
          : 1;
        missingList.push({
          name: r.card.name,
          qty: missingQty,
          editionCode: r.card.editionCode,
        });
      }
    });

    injectSummaryBanner(
      totalCards,
      ownedCards,
      config,
      missingList,
      hasPartial,
    );
  }

  // ─── Populate Collection Select ───

  function populateCollectionSelect(selectedId) {
    fetchCollectionsList().then(function (collections) {
      var select = document.getElementById("le-col-select");
      if (!select) return;

      select.innerHTML = "";

      var noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = selectedId
        ? "Nenhuma (desativado)"
        : "Selecione uma cole\u00e7\u00e3o...";
      select.appendChild(noneOpt);

      collections.forEach(function (col) {
        var opt = document.createElement("option");
        opt.value = col.id;
        opt.textContent =
          col.name + (col.count ? " (" + col.count + " cards)" : "");
        if (col.id === selectedId) opt.selected = true;
        select.appendChild(opt);
      });

      select.disabled = false;

      if (collections.length === 0) {
        select.innerHTML =
          '<option value="">Nenhuma cole\u00e7\u00e3o encontrada</option>';
        select.disabled = true;
      }
    });
  }

  // ─── Summary Banner ───

  function injectSummaryBanner(total, owned, config, missingList, hasPartial) {
    var existing = document.getElementById("le-col-banner");
    if (existing) existing.remove();

    var considerQty = config.le_consider_qty !== false;
    var useEdition = config.le_match_mode === "name+edition";
    var collectionId = config.le_collection_id || "";
    var pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    var missing = total - owned;

    var banner = document.createElement("div");
    banner.id = "le-col-banner";
    banner.className = "le-col-banner";

    if (pct === 100) banner.classList.add("le-col-complete");
    else if (pct >= 50) banner.classList.add("le-col-partial-banner");

    var showPartial = considerQty && hasPartial;
    var legendHtml =
      '<div class="le-col-legend">' +
      '<span class="le-col-legend-item"><span class="le-col-legend-dot" style="background:#28a745"></span> Possui</span>' +
      (showPartial
        ? '<span class="le-col-legend-item"><span class="le-col-legend-dot" style="background:#f0ad4e"></span> Parcial</span>'
        : "") +
      '<span class="le-col-legend-item"><span class="le-col-legend-dot" style="background:#dc3545"></span> Faltando</span>' +
      "</div>";

    var unitLabel = considerQty ? " cartas" : " cartas \u00fanicas";

    var settingsHtml =
      '<div class="le-col-settings">' +
      '<label class="le-col-toggle" title="Quando ativo, diferencia entre possuir parcialmente e possuir todas as c\u00f3pias">' +
      '<input type="checkbox" id="le-col-qty-toggle"' +
      (considerQty ? " checked" : "") +
      ">" +
      "<span>Considerar quantidade</span>" +
      "</label>" +
      '<label class="le-col-toggle" title="Quando ativo, compara considerando a edi\u00e7\u00e3o espec\u00edfica">' +
      '<input type="checkbox" id="le-col-edi-toggle"' +
      (useEdition ? " checked" : "") +
      ">" +
      "<span>Por edi\u00e7\u00e3o</span>" +
      "</label>" +
      "</div>";

    var viewLink = collectionId
      ? ' <a href="/?view=colecao/colecao&id=' +
        escapeHtml(collectionId) +
        '" target="_blank" class="le-col-view-link" title="Abrir cole\u00e7\u00e3o">\u2197</a>'
      : "";

    var selectorHtml =
      '<div class="le-col-selector-row">' +
      '<span class="le-col-banner-title">Cole\u00e7\u00e3o:</span>' +
      '<select id="le-col-select" class="le-col-select" disabled>' +
      '<option value="">Carregando...</option>' +
      "</select>" +
      viewLink +
      "</div>";

    var buttonsHtml = "";
    if (missing > 0) {
      buttonsHtml =
        '<div class="le-col-buttons">' +
        '<button class="le-col-buy-btn" id="le-col-buy-btn">Copiar Faltantes</button>' +
        '<button class="le-col-buy-btn" id="le-col-buylist-btn">Comprar por Lista</button>' +
        "</div>";
    }

    banner.innerHTML =
      '<div class="le-col-banner-info">' +
      selectorHtml +
      '<span class="le-col-banner-stats">' +
      "Possui <b>" +
      owned +
      "</b>/" +
      total +
      unitLabel +
      " (" +
      pct +
      "%)" +
      (missing > 0
        ? " \u2014 <b>" + missing + "</b> faltando"
        : " \u2014 Completo!") +
      "</span>" +
      legendHtml +
      settingsHtml +
      "</div>" +
      buttonsHtml;

    insertBanner(banner);
    populateCollectionSelect(collectionId);

    var selectEl = document.getElementById("le-col-select");
    if (selectEl) {
      selectEl.addEventListener("change", function () {
        var opt = selectEl.options[selectEl.selectedIndex];
        var newId = selectEl.value;
        var newName =
          opt && newId ? opt.textContent.replace(/\s*\(\d+ cards\)$/, "") : "";
        if (newId) {
          loadAndCompare(newId, newName);
        } else {
          clearDots();
          saveConfig("le_collection_id", "");
          saveConfig("le_collection_name", "");
          _state.collectionCards = null;
          _state.maps = null;
          injectSelectorBanner("");
        }
      });
    }

    var qtyToggle = document.getElementById("le-col-qty-toggle");
    if (qtyToggle) {
      qtyToggle.addEventListener("change", function () {
        saveConfig("le_consider_qty", qtyToggle.checked);
        applyComparison();
      });
    }

    var ediToggle = document.getElementById("le-col-edi-toggle");
    if (ediToggle) {
      ediToggle.addEventListener("change", function () {
        saveConfig(
          "le_match_mode",
          ediToggle.checked ? "name+edition" : "name",
        );
        applyComparison();
      });
    }

    if (missing > 0) {
      var buyBtn = document.getElementById("le-col-buy-btn");
      if (buyBtn) {
        buyBtn.addEventListener("click", function () {
          var text = missingList
            .map(function (m) {
              var line = "";
              if (considerQty) line += m.qty + " ";
              line += m.name;
              if (useEdition && m.editionCode)
                line += " [" + m.editionCode + "]";
              return line;
            })
            .join("\n");

          copyToClipboard(text).then(function () {
            buyBtn.textContent = "Copiado!";
            buyBtn.classList.add("le-col-buy-copied");
            setTimeout(function () {
              buyBtn.textContent = "Copiar Faltantes";
              buyBtn.classList.remove("le-col-buy-copied");
            }, 2000);
          });
        });
      }

      var buyListBtn = document.getElementById("le-col-buylist-btn");
      if (buyListBtn) {
        buyListBtn.addEventListener("click", function () {
          var text = missingList
            .map(function (m) {
              var line = m.qty + " " + m.name;
              if (useEdition && m.editionCode)
                line += " [edicao=" + m.editionCode.toLowerCase() + "]";
              return line;
            })
            .join("\n");

          try {
            localStorage.setItem("le_buy_list", text);
          } catch (e) {
            /* ignore */
          }
          window.open("/?view=cards/lista&listaCompra=1", "_blank");
        });
      }
    }
  }

  // ─── DOM Helpers ───

  function insertBanner(banner) {
    var deckView = document.getElementById("deck-view");
    if (deckView && deckView.parentNode) {
      deckView.parentNode.insertBefore(banner, deckView);
      return;
    }
    var header = document.getElementById("deck-header");
    if (header) {
      header.insertAdjacentElement("afterend", banner);
    }
  }

  // ─── Utilities ───

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return Promise.resolve();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Bidirectional Sync ───

  function onConfigChanged() {
    var newConfig = getConfig();
    if (!_state.config) return;

    var changed = false;
    if (newConfig.le_consider_qty !== _state.config.le_consider_qty)
      changed = true;
    if (newConfig.le_match_mode !== _state.config.le_match_mode) changed = true;

    if (changed) {
      _state.config = newConfig;
      applyComparison();
    }

    if (newConfig.le_collection_id !== _state.config.le_collection_id) {
      var newId = newConfig.le_collection_id || "";
      var newName = newConfig.le_collection_name || "";
      _state.config = newConfig;
      if (newId) {
        loadAndCompare(newId, newName);
      } else {
        clearDots();
        _state.collectionCards = null;
        _state.maps = null;
        injectSelectorBanner("");
      }
    }
  }

  // ─── Start Comparison ───

  function startComparison() {
    _state.config = getConfig();
    _state.deckCards = parseDeckCards();
    if (!_state.deckCards.length) return;

    if (!_state.listening) {
      document.addEventListener("le-config-changed", onConfigChanged);
      _state.listening = true;
    }

    injectSelectorBanner("");
  }

  // ─── Init ───

  function init() {
    injectStartBanner();
  }

  // ─── Register ───

  LE.registerModule({
    name: "deck-collection",
    canHandle: canHandle,
    init: init,
  });

  // ─── Auto-fill Compra por Lista ───

  function tryAutoFillBuyList() {
    var pending = localStorage.getItem("le_buy_list");
    if (!pending) return;
    if (location.search.indexOf("view=cards/lista") === -1) return;

    var modalDismissed = false;
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;

      if (!modalDismissed) {
        var modal = document.getElementById("popup-cards-from-storage");
        if (modal && modal.offsetParent !== null) {
          var buttons = modal.querySelectorAll("input[type='button']");
          for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].value === "Ignorar Lista") {
              buttons[i].click();
              modalDismissed = true;
              break;
            }
          }
          return;
        }
      }

      var textarea = document.getElementById("card_list");
      if (textarea) {
        clearInterval(timer);
        textarea.value = pending;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        localStorage.removeItem("le_buy_list");
      } else if (attempts >= 50) {
        clearInterval(timer);
        localStorage.removeItem("le_buy_list");
      }
    }, 200);
  }

  tryAutoFillBuyList();
})();
