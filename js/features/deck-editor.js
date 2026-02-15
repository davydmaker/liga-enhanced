// Liga Enhanced - Deck Editor Module
// Inline deck editing on the view page
(function () {
  'use strict';

  var LE = window.LigaEnhanced;
  if (!LE) return;

  // ─── State ───

  var deckId = null;
  var editing = false;
  var editedCards = [];
  var addedCards = [];
  var searchTimeout = null;
  var activeViewEl = null;
  var sectionInfo = null;
  var mainContainerEl = null;

  var editionCache = {};
  var editionsMap = null;
  var EDITIONS_MAP_KEY = 'le_editions_map';

  var activeEditionDropdown = null;
  var tooltipEl = null;
  var searchUrl = null;

  // ─── Utilities ───

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function decodeHtmlEntities(str) {
    var div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent;
  }

  function insertAfterEl(newEl, refEl) {
    if (refEl.nextSibling) {
      refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
    } else {
      refEl.parentNode.appendChild(newEl);
    }
  }

  function makeHandler(fn) {
    return function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
  }

  // Extract card ID from autocomplete __key: "marketplace:cards:tcg1:56421_1" → "56421"
  function extractCardId(cardData) {
    if (!cardData || !cardData.__key) return '';
    var m = cardData.__key.match(/:(\d+)_/);
    return m ? m[1] : '';
  }

  // ─── Detection & Init ───

  function canHandle() {
    return !!document.getElementById('deck-header')
      && !!document.getElementById('deck-view')
      && !!document.querySelector('.menu-opcoes[id^="menu_"] a[href*="dks/editar"]');
  }

  function getDeckId() {
    var menu = document.querySelector('.menu-opcoes[id^="menu_"]');
    return menu ? menu.id.replace('menu_', '') : null;
  }

  function init() {
    deckId = getDeckId();
    if (!deckId) return;
    createEditButton();
    enhanceCardLinks();
    loadEditionsMap().catch(function () { /* ignore */ });
  }

  function createEditButton() {
    var titleEl = document.querySelector('#deck-header .title');
    if (!titleEl) return;

    var btn = document.createElement('button');
    btn.className = 'le-dk-edit-btn';
    btn.textContent = 'Editar';
    btn.addEventListener('click', function () {
      if (!editing) enterEditMode();
    });
    titleEl.appendChild(btn);
  }

  // ─── DOM Parse ───

  function getActiveView() {
    var containers = document.querySelectorAll('#deck-view > [id^="dk-val-"]');
    for (var i = 0; i < containers.length; i++) {
      if (containers[i].querySelector('.pdeck-block') && containers[i].offsetParent !== null) {
        return containers[i];
      }
    }
    for (var i = 0; i < containers.length; i++) {
      if (containers[i].querySelector('.pdeck-block')) {
        return containers[i];
      }
    }
    return null;
  }

  function parseDeckFromDOM() {
    var cards = [];
    sectionInfo = {
      main:  { lastEl: null, searchBarEl: null },
      side:  { headerEl: null, lastEl: null, searchBarEl: null, injected: false },
      maybe: { headerEl: null, lastEl: null, searchBarEl: null, injected: false }
    };
    if (!activeViewEl) return cards;

    var currentSection = 'main';
    var lines = activeViewEl.querySelectorAll('.deck-line');

    lines.forEach(function (line) {
      var typeEl = line.querySelector('.deck-type, .deck-type-first');
      if (typeEl) {
        var text = typeEl.textContent.trim().toLowerCase();
        if (text.indexOf('sideboard') !== -1) {
          currentSection = 'side';
          sectionInfo.side.headerEl = line;
          sectionInfo.side.lastEl = line;
          return;
        } else if (text.indexOf('maybe') !== -1) {
          currentSection = 'maybe';
          sectionInfo.maybe.headerEl = line;
          sectionInfo.maybe.lastEl = line;
          return;
        }
        if (currentSection === 'main') sectionInfo.main.lastEl = line;
        return;
      }

      var cardLink = line.querySelector('.deck-card a');
      if (!cardLink) return;

      sectionInfo[currentSection].lastEl = line;

      var name = cardLink.getAttribute('data-lc-name') || cardLink.textContent.trim();
      var cardIdAttr = cardLink.getAttribute('data-lc-id') || '';
      var editionIdAttr = cardLink.getAttribute('data-ld-ed') || '';
      var qtyEl = line.querySelector('.deck-qty');
      var qty = qtyEl ? parseInt(qtyEl.textContent.trim()) || 1 : 1;

      var edition = '';
      var rarity = 'C';
      var ediEl = line.querySelector('.deck-edi');
      var edImg = line.querySelector('.deck-edi img');
      if (edImg) {
        if (edImg.title) {
          var match = edImg.title.match(/^\[([^\]]+)\]/);
          if (match) edition = match[1];
        }
        var srcMatch = (edImg.getAttribute('src') || '').match(/_([A-Z])\.gif/);
        if (srcMatch) rarity = srcMatch[1];
      }

      var originalEdiHtml = ediEl ? ediEl.innerHTML : '';

      cards.push({
        qty: qty, originalQty: qty,
        name: name,
        edition: edition, originalEdition: edition,
        editionId: editionIdAttr, originalEditionId: editionIdAttr,
        originalEdiHtml: originalEdiHtml,
        rarity: rarity,
        cardId: cardIdAttr,
        section: currentSection,
        removed: false,
        element: line
      });
    });

    return cards;
  }

  // ─── Edit Mode Lifecycle ───

  function enterEditMode() {
    activeViewEl = getActiveView();
    if (!activeViewEl) {
      return;
    }

    editing = true;
    editedCards = parseDeckFromDOM();
    addedCards = [];
    injectEditControls();
    ensureSections();
    injectSaveBar();
    disableViewTabs();
    updateChangeCount();

    var btn = document.querySelector('.le-dk-edit-btn');
    if (btn) btn.style.display = 'none';

    window.addEventListener('beforeunload', beforeUnloadGuard);
  }

  function exitEditMode() {
    editing = false;
    closeEditionDropdown();
    window.removeEventListener('beforeunload', beforeUnloadGuard);

    editedCards.forEach(function (card) {
      if (!card.element) return;
      card.element.classList.remove('le-dk-removed', 'le-dk-changed');

      var qtyEl = card.element.querySelector('.deck-qty');
      if (qtyEl) qtyEl.style.display = '';

      var ctrl = card.element.querySelector('.le-dk-controls');
      if (ctrl) ctrl.remove();

      var undo = card.element.querySelector('.le-dk-undo-btn');
      if (undo) undo.remove();

      var ediEl = card.element.querySelector('.deck-edi');
      if (ediEl) {
        ediEl.classList.remove('le-dk-edi-clickable');
        if (card.edition !== card.originalEdition && card.originalEdiHtml !== undefined) {
          ediEl.innerHTML = card.originalEdiHtml;
        }
        if (!card.originalEdiHtml) {
          var placeholder = ediEl.querySelector('.le-dk-edi-placeholder');
          if (placeholder) placeholder.remove();
        }
      }
    });

    if (activeViewEl) {
      activeViewEl.querySelectorAll(
        '.le-dk-section-search, .le-dk-added-line, .le-dk-added-header, .le-dk-injected-header'
      ).forEach(function (el) { el.remove(); });
    }

    var saveBar = document.querySelector('.le-dk-save-bar');
    if (saveBar) saveBar.remove();

    destroyTooltipEl();
    enableViewTabs();

    var btn = document.querySelector('.le-dk-edit-btn');
    if (btn) btn.style.display = '';

    editedCards = [];
    addedCards = [];
    activeViewEl = null;
    sectionInfo = null;
    mainContainerEl = null;
    editionCache = {};
  }

  function beforeUnloadGuard(e) {
    if (editing && countChanges() > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  function disableViewTabs() {
    var tabBar = document.getElementById('deck-tab');
    if (tabBar) tabBar.classList.add('le-dk-tabs-disabled');
  }

  function enableViewTabs() {
    var tabBar = document.getElementById('deck-tab');
    if (tabBar) tabBar.classList.remove('le-dk-tabs-disabled');
  }

  // ─── Inline Edit Controls ───

  function injectEditControls() {
    editedCards.forEach(function (card, idx) {
      var leftBox = card.element.querySelector('.deck-box-left');
      if (!leftBox) return;

      var qtyEl = card.element.querySelector('.deck-qty');

      var ctrl = document.createElement('div');
      ctrl.className = 'le-dk-controls';
      ctrl.innerHTML =
        '<button class="le-dk-btn le-dk-minus" title="Diminuir">\u2212</button>' +
        '<span class="le-dk-qty-val">' + card.qty + '</span>' +
        '<button class="le-dk-btn le-dk-plus" title="Aumentar">+</button>' +
        '<button class="le-dk-btn le-dk-remove" title="Remover">\u2715</button>';

      if (qtyEl) {
        qtyEl.style.display = 'none';
        leftBox.insertBefore(ctrl, qtyEl);
      } else {
        leftBox.insertBefore(ctrl, leftBox.firstChild);
      }

      ctrl.querySelector('.le-dk-minus').addEventListener('click', makeHandler(function () {
        changeQty(idx, -1);
      }));
      ctrl.querySelector('.le-dk-plus').addEventListener('click', makeHandler(function () {
        changeQty(idx, 1);
      }));
      ctrl.querySelector('.le-dk-remove').addEventListener('click', makeHandler(function () {
        toggleRemove(idx);
      }));

      if (card.cardId) {
        var ediEl = card.element.querySelector('.deck-edi');
        if (!ediEl) {
          ediEl = document.createElement('div');
          ediEl.className = 'deck-edi';
          ediEl.innerHTML = '<span class="le-dk-edi-placeholder"></span>';
          leftBox.appendChild(ediEl);
        } else if (!ediEl.querySelector('img')) {
          ediEl.innerHTML = '<span class="le-dk-edi-placeholder"></span>';
        }
        ediEl.classList.add('le-dk-edi-clickable');
        ediEl.addEventListener('click', makeHandler(function () {
          showEditionDropdown(card, ediEl);
        }));
      }
    });
  }

  function changeQty(idx, delta) {
    var card = editedCards[idx];
    if (!card || card.removed) return;

    var newQty = card.qty + delta;
    if (newQty < 1) return;

    card.qty = newQty;
    var qtyVal = card.element.querySelector('.le-dk-qty-val');
    if (qtyVal) qtyVal.textContent = newQty;

    card.element.classList.toggle('le-dk-changed', card.qty !== card.originalQty);
    updateChangeCount();
  }

  function toggleRemove(idx) {
    var card = editedCards[idx];
    if (!card) return;

    card.removed = !card.removed;
    card.element.classList.toggle('le-dk-removed', card.removed);

    var existing = card.element.querySelector('.le-dk-undo-btn');
    if (card.removed && !existing) {
      var undo = document.createElement('button');
      undo.className = 'le-dk-undo-btn';
      undo.textContent = 'Desfazer';
      undo.addEventListener('click', makeHandler(function () {
        toggleRemove(idx);
      }));
      card.element.appendChild(undo);
    } else if (!card.removed && existing) {
      existing.remove();
    }

    updateChangeCount();
  }

  // ─── Editions Map (Global Cache) ───

  function loadEditionsMap() {
    if (editionsMap) return Promise.resolve(editionsMap);
    try {
      var stored = localStorage.getItem(EDITIONS_MAP_KEY);
      if (stored) {
        editionsMap = JSON.parse(stored);
        return Promise.resolve(editionsMap);
      }
    } catch (e) { /* corrupt data, re-fetch */ }
    return fetchAndCacheEditions();
  }

  function fetchAndCacheEditions() {
    return fetch('/?view=cards/edicoes')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var jsonStr = extractJsonFromHtml(html, 'jsonEditions');
        if (!jsonStr) throw new Error('jsonEditions not found in page');
        var data = JSON.parse(jsonStr);
        var map = {};

        if (data.main && Array.isArray(data.main)) {
          data.main.forEach(function (ed) {
            map[ed.id] = { sigla: (ed.acronym || '').toUpperCase(), name: ed.name || '' };
          });
        }

        if (data.aux && typeof data.aux === 'object') {
          Object.keys(data.aux).forEach(function (parentId) {
            var arr = data.aux[parentId];
            if (!Array.isArray(arr)) return;
            arr.forEach(function (ed) {
              map[ed.id] = { sigla: (ed.acronym || '').toUpperCase(), name: ed.name || '' };
            });
          });
        }

        editionsMap = map;
        localStorage.setItem(EDITIONS_MAP_KEY, JSON.stringify(map));
        return map;
      });
  }

  function extractJsonFromHtml(html, varName) {
    var idx = html.indexOf(varName);
    if (idx === -1) return null;
    var start = html.indexOf('{', idx);
    if (start === -1) return null;
    var depth = 0;
    for (var i = start; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) return html.substring(start, i + 1);
      }
    }
    return null;
  }

  function getEditionInfo(editionId, callback) {
    if (!editionId) { callback(null); return; }
    if (editionsMap && editionsMap[editionId]) {
      callback(editionsMap[editionId]);
      return;
    }
    editionsMap = null;
    fetchAndCacheEditions().then(function (map) {
      callback(map[editionId] || null);
    }).catch(function () {
      callback(null);
    });
  }

  function buildEditionIconUrl(sigla, rarity) {
    return '//repositorio.sbrauble.com/arquivos/up/ed_mtg/' + sigla + '_' + (rarity || 'C') + '.gif';
  }

  function updateEditionIcon(ediEl, info, rarity) {
    if (!ediEl) return;
    if (info && info.sigla) {
      var iconUrl = buildEditionIconUrl(info.sigla, rarity);
      var title = '[' + info.sigla + '] ' + info.name;
      var existingImg = ediEl.querySelector('img');
      if (existingImg) {
        existingImg.src = iconUrl;
        existingImg.title = title;
      } else {
        ediEl.innerHTML = '<div class="dk-ed-img"><img title="' + escapeAttr(title) +
          '" src="' + escapeAttr(iconUrl) + '" class="img-ed" height="17" /></div>';
      }
    } else {
      ediEl.innerHTML = '<span class="le-dk-edi-placeholder"></span>';
    }
  }

  // ─── Edition Data (Per-Card API) ───

  function fetchEditions(cardId) {
    if (editionCache[cardId]) {
      return Promise.resolve(editionCache[cardId]);
    }

    var fd = new URLSearchParams();
    fd.set('opc', 'getEdicao');
    fd.set('idCard', cardId);
    fd.set('idEdicao', '0');
    fd.set('iTCG', '1');
    fd.set('idLinha', '0');
    fd.set('iTabIndex', '0');

    return fetch('/ajax/bzr/cards.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fd.toString()
    })
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var editions = parseEditionHtml(html);
      editionCache[cardId] = editions;
      return editions;
    });
  }

  function parseEditionHtml(html) {
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    var editions = [];

    var options = doc.querySelectorAll('option');
    if (options.length > 0) {
      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        if (!opt.value || opt.value === '0' || opt.value === '') continue;
        var text = opt.textContent.trim();
        var siglaMatch = text.match(/\[([^\]]+)\]/);
        var sigla = opt.getAttribute('data-sigla')
          || (siglaMatch ? siglaMatch[1] : '');
        var name = siglaMatch
          ? text.replace(/\[([^\]]+)\]\s*/, '').trim()
          : text;
        editions.push({ id: opt.value, sigla: sigla, name: name });
      }
      return editions;
    }

    var items = doc.querySelectorAll('a[data-id], div[data-id], a[onclick], div[onclick]');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      var text = el.textContent.trim();
      if (!text) continue;
      var siglaMatch = text.match(/\[([^\]]+)\]/);
      editions.push({
        id: el.getAttribute('data-id') || el.getAttribute('value') || '',
        sigla: siglaMatch ? siglaMatch[1] : '',
        name: siglaMatch ? text.replace(/\[([^\]]+)\]\s*/, '').trim() : text
      });
    }

    return editions;
  }

  function populateEditionSelect(selectEl, cardData) {
    var defaultSigla = cardData && cardData.sSiglaEdicao || '';
    var cardId = extractCardId(cardData);

    selectEl.innerHTML = '';
    var loadingOpt = document.createElement('option');
    loadingOpt.value = defaultSigla;
    loadingOpt.textContent = defaultSigla
      ? '[' + defaultSigla + '] Carregando...'
      : 'Carregando edi\u00e7\u00f5es...';
    selectEl.appendChild(loadingOpt);
    selectEl.disabled = true;

    if (!cardId) {
      loadingOpt.textContent = defaultSigla ? '[' + defaultSigla + ']' : 'Sem edi\u00e7\u00f5es';
      selectEl.disabled = false;
      return;
    }

    fetchEditions(cardId).then(function (editions) {
      selectEl.innerHTML = '';

      if (!editions.length) {
        var opt = document.createElement('option');
        opt.value = defaultSigla;
        opt.textContent = defaultSigla ? '[' + defaultSigla + ']' : 'Sem edi\u00e7\u00f5es';
        selectEl.appendChild(opt);
        selectEl.disabled = false;
        return;
      }

      editions.forEach(function (ed) {
        var opt = document.createElement('option');
        opt.value = ed.sigla || ed.id;
        opt.dataset.edId = ed.id;
        opt.dataset.sigla = ed.sigla || '';
        var displayName = ed.name.toLowerCase().indexOf('todas edi') !== -1
          ? 'N\u00e3o definida' : ed.name;
        opt.dataset.edName = displayName;
        opt.textContent = ed.sigla
          ? '[' + ed.sigla + '] ' + displayName
          : displayName;
        if (ed.sigla === defaultSigla) opt.selected = true;
        selectEl.appendChild(opt);
      });
      selectEl.disabled = false;
    }).catch(function () {
      selectEl.innerHTML = '';
      var opt = document.createElement('option');
      opt.value = defaultSigla;
      opt.textContent = defaultSigla ? '[' + defaultSigla + ']' : 'Erro';
      selectEl.appendChild(opt);
      selectEl.disabled = false;
    });
  }

  // ─── Edition Dropdown (Existing Cards) ───

  function closeEditionDropdown() {
    if (activeEditionDropdown) {
      activeEditionDropdown.remove();
      activeEditionDropdown = null;
    }
  }

  function showEditionDropdown(card, ediEl) {
    if (activeEditionDropdown && activeEditionDropdown._leCard === card) {
      closeEditionDropdown();
      return;
    }
    closeEditionDropdown();

    var dropdown = document.createElement('div');
    dropdown.className = 'le-dk-edition-dropdown';
    dropdown._leCard = card;
    dropdown.textContent = 'Carregando...';
    document.body.appendChild(dropdown);
    activeEditionDropdown = dropdown;

    var rect = ediEl.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = (rect.left + window.scrollX) + 'px';

    fetchEditions(card.cardId).then(function (editions) {
      if (activeEditionDropdown !== dropdown) return;
      dropdown.textContent = '';

      if (!editions.length) {
        dropdown.textContent = 'Sem edi\u00e7\u00f5es';
        return;
      }

      editions.forEach(function (ed) {
        if (editionsMap && editionsMap[ed.id]) {
          var mapInfo = editionsMap[ed.id];
          if (!ed.sigla && mapInfo.sigla) ed.sigla = mapInfo.sigla;
        }

        var item = document.createElement('div');
        item.className = 'le-dk-edition-option';
        var isCurrent = ed.sigla === card.edition || ed.id === card.editionId;
        if (isCurrent) item.classList.add('le-dk-edition-option-current');

        var isNaoDefinida = ed.name.toLowerCase().indexOf('todas edi') !== -1;
        var displayName = isNaoDefinida ? 'N\u00e3o definida' : ed.name;
        item.textContent = ed.sigla
          ? '[' + ed.sigla + '] ' + displayName
          : displayName;

        item.addEventListener('click', function (e) {
          e.stopPropagation();
          card.edition = ed.sigla || '';
          card.editionId = ed.id;

          var cardEdiEl = card.element.querySelector('.deck-edi');
          if (isNaoDefinida) {
            updateEditionIcon(cardEdiEl, null, card.rarity);
          } else {
            getEditionInfo(ed.id, function (info) {
              updateEditionIcon(cardEdiEl, info || { sigla: ed.sigla, name: ed.name }, card.rarity);
            });
          }

          var changed = card.qty !== card.originalQty || card.edition !== card.originalEdition;
          card.element.classList.toggle('le-dk-changed', changed);
          updateChangeCount();
          closeEditionDropdown();
        });

        dropdown.appendChild(item);
      });
    }).catch(function (err) {
      if (activeEditionDropdown === dropdown) {
        dropdown.textContent = 'Erro ao carregar';
      }
    });

    setTimeout(function () {
      document.addEventListener('click', function handler(e) {
        if (!dropdown.contains(e.target) && !ediEl.contains(e.target)) {
          closeEditionDropdown();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }

  // ─── Added Cards ───

  function addCard(name, section, cardData, selectedEdition, edInfo) {
    var edition = selectedEdition !== undefined ? selectedEdition
      : (cardData && cardData.sSiglaEdicao || '');
    var ei = edInfo || {};

    for (var i = 0; i < addedCards.length; i++) {
      if (addedCards[i].name === name && addedCards[i].section === section
        && addedCards[i].edition === edition && !addedCards[i].removed) {
        addedCards[i].qty++;
        renderAddedCards();
        updateChangeCount();
        return;
      }
    }

    addedCards.push({
      qty: 1, name: name, section: section, removed: false,
      nameEN: cardData && cardData.sNomeIdiomaSecundario ? decodeHtmlEntities(cardData.sNomeIdiomaSecundario) : '',
      imagePath: cardData && cardData.sPathImage || '',
      cardId: extractCardId(cardData),
      edition: edition,
      editionId: ei.id || '',
      editionSigla: ei.sigla || '',
      editionName: ei.name || ''
    });
    renderAddedCards();
    updateChangeCount();
  }

  function renderAddedCards() {
    if (!activeViewEl || !sectionInfo) return;

    activeViewEl.querySelectorAll('.le-dk-added-line, .le-dk-added-header').forEach(function (el) {
      el.remove();
    });

    ['main', 'side', 'maybe'].forEach(function (section) {
      var visible = addedCards.filter(function (c) { return !c.removed && c.section === section; });
      if (!visible.length) return;

      var info = sectionInfo[section];
      if (!info) return;

      var anchor;
      if (section === 'main') {
        anchor = mainContainerEl;
      } else {
        var hasCards = info.lastEl && info.lastEl !== info.headerEl;
        anchor = hasCards ? info.lastEl : info.searchBarEl;
      }
      if (!anchor) return;

      var total = visible.reduce(function (s, c) { return s + c.qty; }, 0);
      var header = document.createElement('div');
      header.className = 'le-dk-added-header';
      header.textContent = 'Adicionadas (' + total + ')';
      insertAfterEl(header, anchor);
      var prevEl = header;

      visible.forEach(function (card) {
        var line = document.createElement('div');
        line.className = 'le-dk-added-line';

        var linkName = card.nameEN || card.name;
        var href = './?view=cards/card&card=' + encodeURIComponent(linkName);
        if (card.editionId) href += '&ed=' + encodeURIComponent(card.editionId);
        var nameHtml = '<a class="le-dk-added-name" href="' + escapeAttr(href) + '" ' +
          'target="_blank">' + escapeHtml(card.name) + '</a>';

        var editionHtml = '';
        var edName = card.editionName || card.editionSigla || '';
        if (edName) {
          editionHtml = '<span class="le-dk-edition-name-text">' + escapeHtml(edName) + '</span>';
        }

        line.innerHTML =
          '<div class="le-dk-controls">' +
            '<button class="le-dk-btn le-dk-minus" title="Diminuir">\u2212</button>' +
            '<span class="le-dk-qty-val">' + card.qty + '</span>' +
            '<button class="le-dk-btn le-dk-plus" title="Aumentar">+</button>' +
            '<button class="le-dk-btn le-dk-remove" title="Remover">\u2715</button>' +
          '</div>' + nameHtml + editionHtml;

        if (card.imagePath) {
          bindCardTooltip(line.querySelector('.le-dk-added-name'), card.imagePath);
        }

        line.querySelector('.le-dk-minus').addEventListener('click', makeHandler(function () {
          if (card.qty > 1) { card.qty--; }
          else { card.removed = true; }
          renderAddedCards();
          updateChangeCount();
        }));
        line.querySelector('.le-dk-plus').addEventListener('click', makeHandler(function () {
          card.qty++;
          renderAddedCards();
          updateChangeCount();
        }));
        line.querySelector('.le-dk-remove').addEventListener('click', makeHandler(function () {
          card.removed = true;
          renderAddedCards();
          updateChangeCount();
        }));

        insertAfterEl(line, prevEl);
        prevEl = line;
      });
    });
  }

  // ─── Card Tooltip ───

  function getTooltipEl() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'le-dk-tooltip';
      tooltipEl.style.cssText =
        'position:fixed;z-index:100000;display:none;pointer-events:none;' +
        'box-shadow:0 4px 20px rgba(0,0,0,0.3);border-radius:8px;overflow:hidden;';
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function bindCardTooltip(el, imagePath) {
    el.addEventListener('mouseenter', function (e) {
      var tip = getTooltipEl();
      tip.innerHTML = '<img src="' + escapeAttr(imagePath) + '" width="312" height="445" style="display:block;">';
      tip.style.display = 'block';
      positionTooltip(tip, e);
    });
    el.addEventListener('mousemove', function (e) {
      var tip = getTooltipEl();
      if (tip.style.display !== 'none') positionTooltip(tip, e);
    });
    el.addEventListener('mouseleave', function () {
      getTooltipEl().style.display = 'none';
    });
  }

  function positionTooltip(tip, e) {
    var x = e.clientX + 20;
    var y = e.clientY - 30;
    var w = 312;
    var h = 445;
    if (x + w > window.innerWidth) x = e.clientX - w - 20;
    if (y + h > window.innerHeight) y = window.innerHeight - h - 10;
    if (y < 0) y = 10;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function destroyTooltipEl() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  // ─── Search Bar & Autocomplete ───

  function createSectionSearchBar(section, placeholder) {
    var bar = document.createElement('div');
    bar.className = 'le-dk-section-search';
    bar.setAttribute('data-section', section);
    bar.innerHTML =
      '<div class="le-dk-search-row">' +
        '<input type="text" class="le-dk-search-input" placeholder="' + placeholder + '" autocomplete="off">' +
        '<select class="le-dk-edition-select"></select>' +
        '<button class="le-dk-add-btn">Adicionar</button>' +
      '</div>' +
      '<div class="le-dk-suggestions"></div>';

    var input = bar.querySelector('.le-dk-search-input');
    var dropdown = bar.querySelector('.le-dk-suggestions');
    var editionSelect = bar.querySelector('.le-dk-edition-select');
    var addBtn = bar.querySelector('.le-dk-add-btn');
    var activeIdx = -1;
    var stagedCard = null;

    editionSelect.style.display = 'none';
    addBtn.style.display = 'none';

    function clearStaged() {
      stagedCard = null;
      editionSelect.style.display = 'none';
      addBtn.style.display = 'none';
      editionSelect.innerHTML = '';
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(searchTimeout);
      activeIdx = -1;

      if (stagedCard && q !== stagedCard.name) {
        clearStaged();
      }

      if (q.length < 3) {
        dropdown.style.display = 'none';
        return;
      }

      if (stagedCard) return;

      searchTimeout = setTimeout(function () {
        fetchSuggestions(input.value.trim(), dropdown, function (name, info) {
          stagedCard = { name: name, info: info };
          input.value = name;
          dropdown.style.display = 'none';
          editionSelect.style.display = '';
          addBtn.style.display = '';
          populateEditionSelect(editionSelect, info);
        });
      }, 350);
    });

    input.addEventListener('keydown', function (e) {
      var items = dropdown.querySelectorAll('.le-dk-suggestion');
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        activeIdx = -1;
        if (stagedCard) {
          clearStaged();
          input.value = '';
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        highlightSuggestion(items, activeIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        highlightSuggestion(items, activeIdx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (stagedCard) {
          addBtn.click();
        } else if (activeIdx >= 0 && items[activeIdx]) {
          items[activeIdx].click();
        }
      }
    });

    addBtn.addEventListener('click', function () {
      if (!stagedCard) return;
      var selectedEdition = editionSelect.value || '';
      var selectedOpt = editionSelect.selectedOptions[0];
      var edInfo = {
        id: selectedOpt ? (selectedOpt.dataset.edId || '') : '',
        sigla: selectedOpt ? (selectedOpt.dataset.sigla || '') : '',
        name: selectedOpt ? (selectedOpt.dataset.edName || '') : ''
      };
      addCard(stagedCard.name, section, stagedCard.info, selectedEdition, edInfo);
      clearStaged();
      input.value = '';
      input.focus();
    });

    document.addEventListener('click', function handler(e) {
      if (!bar.contains(e.target)) {
        dropdown.style.display = 'none';
        activeIdx = -1;
      }
      if (!editing) {
        document.removeEventListener('click', handler);
      }
    });

    return bar;
  }

  function highlightSuggestion(items, idx) {
    items.forEach(function (el, i) {
      el.classList.toggle('le-dk-suggestion-active', i === idx);
    });
  }

  function getSearchUrl() {
    var scripts = document.querySelectorAll('script:not([src])');
    for (var i = 0; i < scripts.length; i++) {
      var m = scripts[i].textContent.match(/cardsearch\?tcg=(\d+)/);
      if (m) return 'https://www.clubedaliga.com.br/api/cardsearch?tcg=' + m[1];
    }
    return 'https://www.clubedaliga.com.br/api/cardsearch?tcg=1';
  }

  function fetchSuggestions(query, dropdown, onSelect) {
    if (!searchUrl) searchUrl = getSearchUrl();

    fetch(searchUrl + '&query=' + encodeURIComponent(query) + '&maxQuantity=8')
      .then(function (r) { return r.json(); })
      .then(function (resp) {
        if (!editing) return;

        var names = resp.suggestions || [];
        var dataArr = resp.data || [];
        if (!names.length) {
          dropdown.style.display = 'none';
          return;
        }

        dropdown.innerHTML = '';
        names.forEach(function (name, i) {
          var displayName = typeof name === 'object' ? name.value : name;
          var info = dataArr[i];
          var primary = info && info.sNomeIdiomaPrincipal
            ? decodeHtmlEntities(info.sNomeIdiomaPrincipal)
            : decodeHtmlEntities(displayName);
          var secondary = info && info.sNomeIdiomaSecundario
            ? decodeHtmlEntities(info.sNomeIdiomaSecundario)
            : '';

          var item = document.createElement('div');
          item.className = 'le-dk-suggestion';

          if (secondary && secondary !== primary) {
            item.innerHTML = escapeHtml(primary) + ' <span style="color:#999;font-size:11px">' + escapeHtml(secondary) + '</span>';
          } else {
            item.textContent = primary;
          }

          item.addEventListener('click', function () {
            onSelect(primary, info);
          });
          dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
      })
      .catch(function (err) {
        dropdown.style.display = 'none';
      });
  }

  // ─── Deck Sections ───

  function ensureSections() {
    var block = activeViewEl.querySelector('.pdeck-block');
    if (!block) return;

    mainContainerEl = block.closest('.pdeck-block-ax') || block;

    var mainSearch = createSectionSearchBar('main', 'Adicionar carta ao deck...');
    mainContainerEl.parentNode.insertBefore(mainSearch, mainContainerEl);
    sectionInfo.main.searchBarEl = mainSearch;

    if (!sectionInfo.side.headerEl) {
      var sideHeader = createSectionHeader('Sideboard');
      if (sectionInfo.maybe.headerEl) {
        sectionInfo.maybe.headerEl.parentNode.insertBefore(sideHeader, sectionInfo.maybe.headerEl);
      } else {
        insertAfterEl(sideHeader, mainContainerEl);
      }
      sectionInfo.side.headerEl = sideHeader;
      sectionInfo.side.lastEl = sideHeader;
      sectionInfo.side.injected = true;
    }

    var sideSearch = createSectionSearchBar('side', 'Adicionar carta ao sideboard...');
    insertAfterEl(sideSearch, sectionInfo.side.headerEl);
    sectionInfo.side.searchBarEl = sideSearch;

    if (!sectionInfo.maybe.headerEl) {
      var maybeHeader = createSectionHeader('Maybeboard');
      var sideEnd = sectionInfo.side.lastEl !== sectionInfo.side.headerEl
        ? sectionInfo.side.lastEl : sideSearch;
      insertAfterEl(maybeHeader, sideEnd);
      sectionInfo.maybe.headerEl = maybeHeader;
      sectionInfo.maybe.lastEl = maybeHeader;
      sectionInfo.maybe.injected = true;
    }

    var maybeSearch = createSectionSearchBar('maybe', 'Adicionar carta ao maybeboard...');
    insertAfterEl(maybeSearch, sectionInfo.maybe.headerEl);
    sectionInfo.maybe.searchBarEl = maybeSearch;
  }

  function createSectionHeader(title) {
    var line = document.createElement('div');
    line.className = 'deck-line le-dk-injected-header';
    line.innerHTML = '<div class="deck-type">' + title + '</div>';
    return line;
  }

  // ─── Change Tracking ───

  function countChanges() {
    var n = 0;
    editedCards.forEach(function (c) {
      if (c.removed) n++;
      else if (c.qty !== c.originalQty) n++;
      else if (c.edition !== c.originalEdition) n++;
    });
    addedCards.forEach(function (c) {
      if (!c.removed) n++;
    });
    return n;
  }

  function updateChangeCount() {
    var n = countChanges();
    var el = document.querySelector('.le-dk-changes');
    if (el) {
      el.textContent = n === 0 ? 'Nenhuma altera\u00e7\u00e3o'
        : n === 1 ? '1 altera\u00e7\u00e3o'
        : n + ' altera\u00e7\u00f5es';
    }
    var saveBtn = document.querySelector('.le-dk-save');
    if (saveBtn) saveBtn.disabled = n === 0;
  }

  // ─── Save ───

  function injectSaveBar() {
    var bar = document.createElement('div');
    bar.className = 'le-dk-save-bar';
    bar.innerHTML =
      '<span class="le-dk-changes">Nenhuma altera\u00e7\u00e3o</span>' +
      '<button class="le-dk-cancel">Cancelar</button>' +
      '<button class="le-dk-save" disabled>Salvar Deck</button>';

    document.body.appendChild(bar);

    bar.querySelector('.le-dk-cancel').addEventListener('click', function () {
      exitEditMode();
    });
    bar.querySelector('.le-dk-save').addEventListener('click', function () {
      saveDeck();
    });
  }

  function serializeSection(section) {
    var lines = [];

    editedCards.forEach(function (card) {
      if (card.removed || card.section !== section) return;
      var line = card.qty + ' ' + card.name;
      if (card.edition) line += ' [' + card.edition + ']';
      lines.push(line);
    });

    addedCards.forEach(function (card) {
      if (card.removed || card.section !== section) return;
      var line = card.qty + ' ' + card.name;
      if (card.edition) line += ' [' + card.edition + ']';
      lines.push(line);
    });

    return lines.join('\n');
  }

  function saveDeck() {
    var saveBtn = document.querySelector('.le-dk-save');
    var cancelBtn = document.querySelector('.le-dk-cancel');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }
    if (cancelBtn) cancelBtn.disabled = true;

    fetch('/?view=dks/editar&id=' + deckId)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        var tokenEl = doc.querySelector('[name="VALID_SEC_UNIQUE_TOKEN"]');
        if (!tokenEl) throw new Error('Token CSRF n\u00e3o encontrado');

        var val = function (sel) {
          var el = doc.querySelector(sel);
          return el ? (el.value || '') : '';
        };
        var checked = function (name, fallback) {
          var el = doc.querySelector('input[name="' + name + '"]:checked');
          return el ? el.value : fallback;
        };

        var fd = new URLSearchParams();
        fd.set('VALID_SEC_UNIQUE_TOKEN', tokenEl.value);
        fd.set('iddeck', deckId);
        fd.set('deck_nome', val('#deck_nome'));
        fd.set('deck_formato', val('#deck_formato'));
        fd.set('deck_privacidade', checked('deck_privacidade', '2'));
        fd.set('txt_descricao', val('#txt_descricao'));

        fd.set('txt_deck_commander', val('#txt_deck_commander'));
        fd.set('txt_deck_commander_edicao', val('#txt_deck_commander_edicao'));
        fd.set('txt_deck_commanderparceiro', val('#txt_deck_commanderparceiro'));
        fd.set('txt_deck_commanderparceiro_edicao', val('#txt_deck_commanderparceiro_edicao'));
        fd.set('txt_deck_oathbreaker_parc', val('#txt_deck_oathbreaker_parc'));
        fd.set('txt_deck_oathbreaker_parc_edicao', val('#txt_deck_oathbreaker_parc_edicao'));
        fd.set('txt_deck_signspell_parc', val('#txt_deck_signspell_parc'));
        fd.set('txt_deck_signspell_parc_edicao', val('#txt_deck_signspell_parc_edicao'));
        fd.set('txt_deck_companion', val('#txt_deck_companion'));

        var compCheck = doc.querySelector('[name="txt_comp_checked"]');
        fd.set('txt_comp_checked', compCheck ? compCheck.value : '0');

        var bo1 = doc.querySelector('#deck_formato_bo1');
        if (bo1 && bo1.checked) fd.set('deck_formato_bo1', bo1.value);
        fd.set('deck_arquetipo', val('#deck_arquetipo'));

        fd.set('txt_deck', serializeSection('main'));
        fd.set('txt_side', serializeSection('side'));
        fd.set('txt_maybe', serializeSection('maybe'));

        fd.set('btCadDeck', 'Editar Deck');

        return fetch('/?view=dks/editar&id=' + deckId + '&edt=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: fd.toString()
        });
      })
      .then(function (resp) {
        if (resp.ok) {
          window.removeEventListener('beforeunload', beforeUnloadGuard);
          location.reload();
        } else {
          throw new Error('HTTP ' + resp.status);
        }
      })
      .catch(function (err) {
        alert('Erro ao salvar deck: ' + err.message);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar Deck'; }
        if (cancelBtn) cancelBtn.disabled = false;
      });
  }

  // ─── Card Link Enhancement ───

  function enhanceCardLinks() {
    var container = document.getElementById('deck-view');
    if (!container) return;

    var cardLinks = container.querySelectorAll('.deck-card a');
    for (var i = 0; i < cardLinks.length; i++) {
      var link = cardLinks[i];
      var editionId = link.getAttribute('data-ld-ed');
      var href = link.getAttribute('href') || '';
      if (editionId && href.indexOf('&ed=') === -1) {
        link.setAttribute('href', href + '&ed=' + editionId);
      }
    }
  }

  // ─── Register ───

  LE.registerModule({
    name: 'deck-editor',
    canHandle: canHandle,
    init: init
  });
})();
