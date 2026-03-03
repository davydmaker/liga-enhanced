(function () {
  "use strict";

  var LE = window.LigaEnhanced;
  if (!LE) return;

  var STORAGE_KEY = "le_blocked_cards";
  var IMGS_KEY = "le_blocked_imgs";

  // ─── Anti-flash ───

  function injectAntiFlashCSS() {
    var blocked = getBlockedCards();
    if (blocked.length === 0) return;

    var style = document.createElement("style");
    style.id = "le-antiflash";
    style.textContent =
      "#card-estoque > div:not([data-le-ok])," +
      "#showcase-itens-show > div:not([data-le-ok])" +
      "{ opacity: 0 !important; max-height: 0 !important; overflow: hidden !important;" +
      "  padding-top: 0 !important; padding-bottom: 0 !important;" +
      "  margin-top: 0 !important; margin-bottom: 0 !important;" +
      "  border: none !important; transition: none !important; }";
    document.head.appendChild(style);
  }

  // ─── Storage ───

  function getBlockedCards() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveBlockedCards(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
    try {
      document.dispatchEvent(new CustomEvent("le-blocked-save"));
    } catch (e) {
      /* ignore */
    }
  }

  function getBlockedImgs() {
    try {
      return JSON.parse(localStorage.getItem(IMGS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveBlockedImgs(map) {
    try {
      localStorage.setItem(IMGS_KEY, JSON.stringify(map));
    } catch (e) {
      /* ignore */
    }
    try {
      document.dispatchEvent(new CustomEvent("le-blocked-imgs-save"));
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeName(str) {
    return str.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function ensureHttps(url) {
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    return url;
  }

  function blockCard(nameEN, imgUrl) {
    var name = normalizeName(nameEN);
    if (!name) return;
    var list = getBlockedCards();
    if (list.indexOf(name) === -1) {
      list.push(name);
      saveBlockedCards(list);
    }
    if (imgUrl) {
      var imgs = getBlockedImgs();
      imgs[name] = ensureHttps(imgUrl);
      saveBlockedImgs(imgs);
    }
  }

  function unblockCard(nameEN) {
    var name = normalizeName(nameEN);
    if (!name) return;
    var list = getBlockedCards();
    var idx = list.indexOf(name);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveBlockedCards(list);
    }
    var imgs = getBlockedImgs();
    if (imgs[name]) {
      delete imgs[name];
      saveBlockedImgs(imgs);
    }
  }

  function extractNameFromHref(href) {
    if (!href) return "";
    var match = href.match(/[?&]card=([^&]+)/);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch (e) {
      return match[1].replace(/\+/g, " ");
    }
  }

  // ─── Detection ───

  var _pageType = null;

  function detectPageType() {
    if (typeof edc !== "undefined" && document.querySelector(".grid-cardsinput"))
      return "edc";
    if (typeof bzr !== "undefined" && document.getElementById("card-estoque"))
      return "bzr";
    if (
      typeof showcase !== "undefined" &&
      document.querySelector(".screenfilter-list-filters")
    )
      return "showcase";
    if (typeof mpcard !== "undefined") return "mpcard";
    if (document.querySelector(".mtg-single"))
      return "marketplace";
    return null;
  }

  function canHandle() {
    _pageType = detectPageType();
    // Anti-flash CSS only needed for bzr/showcase: cards are direct children of the
    // container and dynamically loaded (no built-in loading screen).
    // EDC already hides #card-estoque until edc.show() runs, so no flash occurs there.
    if (
      (_pageType === "bzr" || _pageType === "showcase") &&
      !document.getElementById("le-antiflash")
    ) {
      injectAntiFlashCSS();
    }
    return !!_pageType;
  }

  // ─── Generic Helpers ───

  function getCardNameEN(card) {
    // Showcase (vitrine): .name-en has the EN name when PT differs from EN.
    // .cut-name has the PT name (or EN when there is no PT translation).
    var nameEnEl = card.querySelector(".name-en");
    if (nameEnEl) {
      var enText = nameEnEl.textContent.trim();
      if (enText) return enText;
    }
    var auxEl = card.querySelector(".cardname-aux a, .cardname-aux");
    if (auxEl) {
      var text2 = auxEl.textContent.trim();
      if (text2) return text2;
    }
    var mtgAux = card.querySelector(".mtg-name-aux a");
    if (mtgAux) {
      var mtgText = mtgAux.textContent.trim();
      if (mtgText) return mtgText;
    }
    var link = card.querySelector("a[href*='card=']");
    if (link) return extractNameFromHref(link.getAttribute("href"));
    // .cut-name has EN name only when there's no PT translation
    var cutName = card.querySelector(".cut-name");
    if (cutName) {
      var text = cutName.textContent.trim();
      if (text) return text;
    }
    return "";
  }

  function getCardImgUrl(card) {
    var showcaseImg = card.querySelector(".image img[data-src]");
    if (showcaseImg) return showcaseImg.getAttribute("data-src");
    var img = card.querySelector("a[href*='card='] img[data-src]");
    if (img && !img.classList.contains("item-newtab")) return img.getAttribute("data-src");
    img = card.querySelector("a[href*='card='] img[src]");
    if (img && img.src && img.src.indexOf("data:") !== 0 && !img.classList.contains("item-newtab"))
      return img.src;
    img = card.querySelector("img[data-src]");
    if (img && !img.classList.contains("item-newtab")) return img.getAttribute("data-src");
    return "";
  }

  function findImageContainer(card) {
    var c =
      card.querySelector(".imagem") ||
      card.querySelector(".mtg-picture") ||
      card.querySelector(".card-item");
    if (c) return c;
    var img = card.querySelector("a[href*='card='] img");
    if (img) {
      var link = img.closest("a");
      if (link && link.parentElement && link.parentElement !== card)
        return link.parentElement;
      return link || img.parentElement;
    }
    return null;
  }

  // ─── Block Button ───

  function createBlockButton(cardNameEN, imgUrl, onBlock) {
    var btn = document.createElement("button");
    btn.className = "le-block-btn";
    btn.title = "Ocultar: " + cardNameEN;
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
      '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
      '<path d="m1 1 22 22"/>' +
      '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>' +
      "</svg>";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (confirm('Ocultar "' + cardNameEN + '" em todas as buscas?')) {
        blockCard(cardNameEN, imgUrl);
        if (onBlock) onBlock();
      }
    });
    return btn;
  }

  // ─── EDC Blocking ───

  var _edcOrigReloadExec = null;

  function initEdcBlocking() {
    if (typeof edc === "undefined" || typeof edc.reloadExec !== "function")
      return;

    // Hook isFetched to filter blocked cards without modifying edc.obj
    var origIsFetched = edc.isFetched;
    edc.isFetched = function (card) {
      var name = normalizeName((card && card.nEN) || "");
      if (name && getBlockedCards().indexOf(name) !== -1) return false;
      return origIsFetched.apply(this, arguments);
    };

    _edcOrigReloadExec = edc.reloadExec;
    edc.reloadExec = function () {
      _edcOrigReloadExec.apply(this, arguments);
      injectEdcBlockButtons();
    };

    hideBlockedEdcDomCards();
    injectEdcBlockButtons();
  }

  function hideBlockedEdcDomCards() {
    var blocked = getBlockedCards();
    if (blocked.length === 0) return;

    var grid = document.querySelector(".grid-cardsinput");
    if (!grid) return;

    var cards = grid.querySelectorAll(".card-item");
    if (cards.length === 0) cards = grid.querySelectorAll(":scope > [data-tooltip]");
    if (cards.length === 0) cards = grid.querySelectorAll(":scope > div");
    cards = Array.from(cards);

    cards.forEach(function (card) {
      if (card.dataset.leBlocked === "1") return;
      var nameEN = getEdcCardNameEN(card);
      if (nameEN && blocked.indexOf(normalizeName(nameEN)) !== -1) {
        card.style.display = "none";
        card.dataset.leBlocked = "1";
      }
    });
  }

  function applyEdcBlocking() {
    if (typeof edc === "undefined" || !_edcOrigReloadExec) return;
    edc.reloadExec();
  }

  function getEdcCardNameEN(cardEl) {
    // invisible-label format: "<b>PT Name</b><br/>EN Name"
    var label = cardEl.querySelector(".invisible-label");
    if (label) {
      var html = label.innerHTML;
      var parts = html.split(/<br\s*\/?>/i);
      if (parts.length >= 2) {
        var tmp = document.createElement("span");
        tmp.innerHTML = parts[1];
        var en = tmp.textContent.trim();
        if (en) return en;
      }
    }
    var link = cardEl.querySelector("a[href*='card=']");
    if (link) return extractNameFromHref(link.getAttribute("href"));
    var itemId = cardEl.id;
    if (itemId && typeof edc !== "undefined" && Array.isArray(edc.obj)) {
      var key = itemId.replace("item_", "");
      for (var i = 0; i < edc.obj.length; i++) {
        if (String(edc.obj[i].id) === key) return edc.obj[i].nEN || "";
      }
    }
    return "";
  }

  function injectEdcBlockButtons() {
    var grid = document.querySelector(".grid-cardsinput");
    if (!grid) return;

    var cards = grid.querySelectorAll(".card-item");
    if (cards.length === 0) {
      cards = grid.querySelectorAll(":scope > [data-tooltip]");
    }
    if (cards.length === 0) {
      cards = grid.querySelectorAll(":scope > div");
    }

    var processed = {};
    cards.forEach(function (cardEl) {
      if (cardEl.querySelector(".le-block-btn")) return;

      var nameEN = getEdcCardNameEN(cardEl);
      if (!nameEN) return;
      var key = normalizeName(nameEN);
      if (processed[key]) return;
      processed[key] = true;

      var imgUrl = getCardImgUrl(cardEl);
      var btn = createBlockButton(nameEN, imgUrl, function () {
        applyEdcBlocking();
      });
      btn.classList.add("le-block-btn-left");

      var figure = cardEl.querySelector("figure");
      if (!figure) figure = cardEl.querySelector(".flip-img");
      if (!figure) {
        var container = findImageContainer(cardEl);
        figure = container || cardEl;
      }
      figure.style.position = "relative";
      figure.appendChild(btn);
    });
  }

  // ─── BZR Blocking ───

  var _bzrObserver = null;

  function initBzrBlocking() {
    hideBlockedBzrCards();
    injectBzrBlockButtons();

    var container = document.getElementById("card-estoque");
    if (!container) return;

    _bzrObserver = new MutationObserver(function () {
      hideBlockedBzrCards();
      injectBzrBlockButtons();
    });
    _bzrObserver.observe(container, { childList: true, subtree: true });
  }

  function getBzrCards() {
    var container = document.getElementById("card-estoque");
    if (!container) return [];
    return Array.from(container.querySelectorAll(":scope > div"));
  }

  function hideBlockedBzrCards() {
    var blocked = getBlockedCards();

    getBzrCards().forEach(function (card) {
      if (card.dataset.leBlocked === "1") return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.length > 0 && blocked.indexOf(normalizeName(nameEN)) !== -1) {
        card.style.display = "none";
        card.dataset.leBlocked = "1";
      } else {
        card.dataset.leOk = "1";
      }
    });
  }

  function injectBzrBlockButtons() {
    getBzrCards().forEach(function (card) {
      if (card.querySelector(".le-block-btn")) return;
      if (card.dataset.leBlocked === "1") return;

      var nameEN = getCardNameEN(card);
      if (!nameEN) return;

      var imgUrl = getCardImgUrl(card);
      var btn = createBlockButton(nameEN, imgUrl, function () {
        card.style.display = "none";
        card.dataset.leBlocked = "1";
      });
      btn.classList.add("le-block-btn-left");

      var container = findImageContainer(card);
      if (container) {
        container.style.position = "relative";
        container.appendChild(btn);
      } else {
        card.style.position = "relative";
        card.appendChild(btn);
      }
    });
  }

  function reapplyBzrBlocking() {
    var blocked = getBlockedCards();
    getBzrCards().forEach(function (card) {
      if (card.dataset.leBlocked !== "1") return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.indexOf(normalizeName(nameEN)) === -1) {
        card.style.display = "";
        delete card.dataset.leBlocked;
        card.dataset.leOk = "1";
      }
    });
    hideBlockedBzrCards();
    injectBzrBlockButtons();
  }

  // ─── Showcase Blocking ───

  var _showcaseObserver = null;

  function getShowcaseContainer() {
    return (
      document.getElementById("showcase-itens-show") ||
      document.querySelector(".single-cards") ||
      document.getElementById("container-single-cards")
    );
  }

  function initShowcaseBlocking() {
    hideBlockedShowcaseCards();
    injectShowcaseBlockButtons();

    var container = getShowcaseContainer();
    if (!container) return;

    _showcaseObserver = new MutationObserver(function () {
      hideBlockedShowcaseCards();
      injectShowcaseBlockButtons();
    });
    _showcaseObserver.observe(container, { childList: true, subtree: true });
  }

  function getShowcaseCards() {
    var container = getShowcaseContainer();
    if (!container) return [];
    var cards = Array.from(container.querySelectorAll(":scope > .container-single-card"));
    if (cards.length === 0) {
      cards = Array.from(container.querySelectorAll(":scope > div"));
    }
    return cards;
  }

  function hideBlockedShowcaseCards() {
    var blocked = getBlockedCards();

    getShowcaseCards().forEach(function (card) {
      if (card.dataset.leBlocked === "1") return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.length > 0 && blocked.indexOf(normalizeName(nameEN)) !== -1) {
        card.style.display = "none";
        card.dataset.leBlocked = "1";
      } else {
        card.dataset.leOk = "1";
      }
    });
  }

  function injectShowcaseBlockButtons() {
    getShowcaseCards().forEach(function (card) {
      if (card.querySelector(".le-block-btn-inline")) return;
      if (card.dataset.leBlocked === "1") return;

      var nameEN = getCardNameEN(card);
      if (!nameEN) return;

      var imgUrl = getCardImgUrl(card);
      var btn = createBlockButton(nameEN, imgUrl, function () {
        card.style.display = "none";
        card.dataset.leBlocked = "1";
      });
      btn.className = "le-block-btn-inline";

      // Target .name (flex row) to keep button inline with card name and ↗ icon
      var target =
        card.querySelector(".name") ||
        card.querySelector(".container-name") ||
        card.querySelector(".image-and-name") ||
        card.querySelector(".head") ||
        card;
      target.appendChild(btn);
    });
  }

  function reapplyShowcaseBlocking() {
    var blocked = getBlockedCards();
    getShowcaseCards().forEach(function (card) {
      if (card.dataset.leBlocked !== "1") return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.indexOf(normalizeName(nameEN)) === -1) {
        card.style.display = "";
        delete card.dataset.leBlocked;
        card.dataset.leOk = "1";
      }
    });
    hideBlockedShowcaseCards();
    injectShowcaseBlockButtons();
  }

  // ─── Marketplace Blocking ───

  var _mpObserver = null;

  function initMarketplaceBlocking() {
    hideBlockedMarketplaceCards();
    injectMarketplaceBlockButtons();

    var container = document.getElementById("mtg-cards");
    if (!container) return;

    _mpObserver = new MutationObserver(function () {
      hideBlockedMarketplaceCards();
      injectMarketplaceBlockButtons();
    });
    _mpObserver.observe(container, { childList: true, subtree: true });
  }

  function hideBlockedMarketplaceCards() {
    var blocked = getBlockedCards();
    if (blocked.length === 0) return;

    document.querySelectorAll(".mtg-single").forEach(function (card) {
      var wrapper = card.closest(".box") || card;
      if (wrapper.dataset.leBlocked === "1") return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.indexOf(normalizeName(nameEN)) !== -1) {
        wrapper.style.display = "none";
        wrapper.dataset.leBlocked = "1";
      }
    });
  }

  function injectMarketplaceBlockButtons() {
    document.querySelectorAll(".mtg-single").forEach(function (card) {
      if (card.querySelector(".le-block-btn")) return;
      var wrapper = card.closest(".box") || card;
      if (wrapper.dataset.leBlocked === "1") return;

      var nameEN = getCardNameEN(card);
      if (!nameEN) return;

      var imgUrl = getCardImgUrl(card);
      var btn = createBlockButton(nameEN, imgUrl, function () {
        wrapper.style.display = "none";
        wrapper.dataset.leBlocked = "1";
      });
      btn.classList.add("le-block-btn-left");

      var container = findImageContainer(card);
      if (container) {
        container.style.position = "relative";
        container.appendChild(btn);
      }
    });
  }

  function reapplyMarketplaceBlocking() {
    var blocked = getBlockedCards();
    document.querySelectorAll("[data-le-blocked]").forEach(function (el) {
      var card = el.classList.contains("mtg-single")
        ? el
        : el.querySelector(".mtg-single");
      if (!card) return;
      var nameEN = getCardNameEN(card);
      if (nameEN && blocked.indexOf(normalizeName(nameEN)) === -1) {
        el.style.display = "";
        delete el.dataset.leBlocked;
      }
    });
    hideBlockedMarketplaceCards();
    injectMarketplaceBlockButtons();
  }

  // ─── Mpcard Banner ───

  var _mpcardNameEN = "";
  var _mpcardBanner = null;

  function getMpcardImgUrl() {
    var img = document.getElementById("featuredImage");
    if (img) {
      var src = img.getAttribute("data-src") || img.getAttribute("src") || "";
      return ensureHttps(src);
    }
    return "";
  }

  function initMpcardBlocking() {
    _mpcardNameEN = extractNameFromHref(location.href);
    if (!_mpcardNameEN) {
      var enEl = document.querySelector(".item-name-en");
      if (enEl) _mpcardNameEN = enEl.textContent.trim();
    }
    if (!_mpcardNameEN) return;

    var blocked = getBlockedCards();
    var isBlocked = blocked.indexOf(normalizeName(_mpcardNameEN)) !== -1;
    injectMpcardBanner(_mpcardNameEN, isBlocked);
  }

  function injectMpcardBanner(nameEN, isBlocked) {
    _mpcardBanner = document.createElement("div");
    _mpcardBanner.className = "le-mpcard-banner";
    renderBannerState(nameEN, isBlocked);

    var ref =
      document.querySelector(".container-item-info") ||
      document.getElementById("marketplace-stores") ||
      document.querySelector("main");

    if (ref && ref.parentElement) {
      ref.parentElement.insertBefore(_mpcardBanner, ref);
    } else {
      var header = document.querySelector("header");
      if (header) {
        header.insertAdjacentElement("afterend", _mpcardBanner);
      } else {
        document.body.insertBefore(_mpcardBanner, document.body.firstChild);
      }
    }
  }

  function renderBannerState(nameEN, isBlocked) {
    if (!_mpcardBanner) return;

    _mpcardBanner.className = "le-mpcard-banner " +
      (isBlocked ? "le-mpcard-banner-blocked" : "le-mpcard-banner-normal");

    var eyeIcon =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (isBlocked
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
          '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
          '<path d="m1 1 22 22"/>' +
          '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
          '<circle cx="12" cy="12" r="3"/>') +
      "</svg>";

    var text = isBlocked
      ? "Esta carta está oculta nas buscas"
      : "Liga Enhanced";

    var btnText = isBlocked ? "Exibir novamente" : "Ocultar carta";
    var btnClass = isBlocked ? "le-mpcard-btn-unblock" : "le-mpcard-btn-block";

    _mpcardBanner.innerHTML =
      '<div class="le-mpcard-banner-text">' + eyeIcon + " " + text + "</div>" +
      '<button class="le-mpcard-btn ' + btnClass + '">' + btnText + "</button>";

    var btn = _mpcardBanner.querySelector(".le-mpcard-btn");
    btn.addEventListener("click", function () {
      if (isBlocked) {
        unblockCard(nameEN);
      } else {
        blockCard(nameEN, getMpcardImgUrl());
      }
      renderBannerState(nameEN, !isBlocked);
    });
  }

  function refreshMpcardBanner() {
    if (!_mpcardNameEN || !_mpcardBanner) return;
    var blocked = getBlockedCards();
    var isBlocked = blocked.indexOf(normalizeName(_mpcardNameEN)) !== -1;
    renderBannerState(_mpcardNameEN, isBlocked);
  }

  // ─── Blocked Changed ───

  function onBlockedChanged() {
    if (_pageType === "edc") {
      applyEdcBlocking();
    } else if (_pageType === "bzr") {
      reapplyBzrBlocking();
    } else if (_pageType === "showcase") {
      reapplyShowcaseBlocking();
    } else if (_pageType === "marketplace") {
      reapplyMarketplaceBlocking();
    } else if (_pageType === "mpcard") {
      refreshMpcardBanner();
    }
  }

  // ─── Init ───

  function init() {
    if (_pageType === "edc") {
      initEdcBlocking();
    } else if (_pageType === "bzr") {
      initBzrBlocking();
    } else if (_pageType === "showcase") {
      initShowcaseBlocking();
    } else if (_pageType === "marketplace") {
      initMarketplaceBlocking();
    } else if (_pageType === "mpcard") {
      initMpcardBlocking();
    }

    document.addEventListener("le-blocked-changed", onBlockedChanged);
  }

  // ─── Register ───

  LE.registerModule({
    name: "block-cards",
    canHandle: canHandle,
    init: init,
  });
})();
