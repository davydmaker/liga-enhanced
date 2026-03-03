(function () {
  "use strict";

  var STORAGE_KEY = "le_blocked_cards";
  var IMGS_KEY = "le_blocked_imgs";
  var CARD_URL = "https://www.ligamagic.com.br/?view=cards/card&card=";

  var listEl = document.getElementById("card-list");
  var emptyEl = document.getElementById("empty");
  var infoEl = document.getElementById("info");
  var searchEl = document.getElementById("search");

  var blockedImgs = {};

  function ensureHttps(url) {
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    return url;
  }

  // ─── Tooltip ───

  var tooltip = document.createElement("div");
  tooltip.className = "card-preview";
  tooltip.innerHTML = '<img class="card-preview-img" alt="">';
  document.body.appendChild(tooltip);
  var tooltipImg = tooltip.querySelector("img");
  var tooltipTimer = null;

  function showPreview(el, cardName, normalizedName) {
    var imgUrl = blockedImgs[normalizedName];
    if (!imgUrl) return;

    tooltipTimer = setTimeout(function () {
      tooltipImg.src = ensureHttps(imgUrl);
      tooltipImg.alt = cardName;

      var rect = el.getBoundingClientRect();
      tooltip.style.top = rect.bottom + window.scrollY + 8 + "px";
      tooltip.style.left = rect.left + window.scrollX + "px";
      tooltip.classList.add("card-preview-show");
    }, 300);
  }

  function hidePreview() {
    clearTimeout(tooltipTimer);
    tooltip.classList.remove("card-preview-show");
    tooltipImg.src = "";
  }

  // ─── Storage ───

  function getBlockedCards(callback) {
    chrome.storage.local.get({ le_blocked_cards: "[]" }, function (data) {
      try {
        callback(JSON.parse(data.le_blocked_cards || "[]"));
      } catch (e) {
        callback([]);
      }
    });
  }

  function saveBlockedCards(list, removedName) {
    chrome.storage.local.set({ le_blocked_cards: JSON.stringify(list) });
    if (removedName && blockedImgs[removedName]) {
      delete blockedImgs[removedName];
      chrome.storage.local.set({ le_blocked_imgs: JSON.stringify(blockedImgs) });
    }
  }

  function capitalize(str) {
    return str.replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  // ─── Render ───

  function render(cards, filter) {
    listEl.innerHTML = "";
    var filtered = cards;

    if (filter) {
      var q = filter.toLowerCase();
      filtered = cards.filter(function (name) {
        return name.indexOf(q) !== -1;
      });
    }

    infoEl.textContent =
      cards.length > 0
        ? cards.length +
          (cards.length === 1 ? " carta oculta" : " cartas ocultas")
        : "";

    if (cards.length === 0) {
      emptyEl.style.display = "";
      return;
    }
    emptyEl.style.display = "none";

    if (filtered.length === 0) {
      var noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.textContent = "Nenhum resultado para a busca";
      listEl.appendChild(noResults);
      return;
    }

    filtered
      .slice()
      .sort()
      .forEach(function (name) {
        var row = document.createElement("div");
        row.className = "card-item";

        var link = document.createElement("a");
        link.className = "card-name";
        link.href = CARD_URL + encodeURIComponent(capitalize(name));
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = capitalize(name);

        link.addEventListener("mouseenter", function () {
          showPreview(link, capitalize(name), name);
        });
        link.addEventListener("mouseleave", hidePreview);

        var btn = document.createElement("button");
        btn.className = "unblock-btn";
        btn.textContent = "Exibir novamente";
        btn.addEventListener("click", function () {
          var updated = cards.filter(function (n) {
            return n !== name;
          });
          saveBlockedCards(updated, name);
          render(updated, searchEl.value.trim());
        });

        row.appendChild(link);
        row.appendChild(btn);
        listEl.appendChild(row);
      });
  }

  // ─── Init ───

  function loadImgsAndRender(cards, filter) {
    chrome.storage.local.get({ le_blocked_imgs: "{}" }, function (data) {
      try {
        blockedImgs = JSON.parse(data.le_blocked_imgs || "{}");
      } catch (e) {
        blockedImgs = {};
      }
      render(cards, filter);
    });
  }

  getBlockedCards(function (cards) {
    loadImgsAndRender(cards);

    searchEl.addEventListener("input", function () {
      getBlockedCards(function (cards) {
        render(cards, searchEl.value.trim());
      });
    });
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes.le_blocked_cards) {
      getBlockedCards(function (cards) {
        loadImgsAndRender(cards, searchEl.value.trim());
      });
    }
    if (area === "local" && changes.le_blocked_imgs) {
      try {
        blockedImgs = JSON.parse(changes.le_blocked_imgs.newValue || "{}");
      } catch (e) {
        /* ignore */
      }
    }
  });
})();
