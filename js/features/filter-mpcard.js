// Liga Enhanced - MPCARD Filter Module
// Filters for marketplace, buylist, bazar card detail pages (mpcard/screenfilter)
(function () {
  'use strict';

  const LE = window.LigaEnhanced;
  if (!LE) return;

  const ui = LE.ui;
  const C = LE.constants;

  // ─── State ───

  let allStock = [];
  let initEditions = [];
  let initStores = {};
  let mplinePrefix = 'mpline_1_';
  let isBuylist = false;
  let isProduct = false;
  let activeFilters = { qualid: [], idioma: [], extras: [], edicao: [], num: [], lj_uf: [], lj_tipo: [], lj_ref: [], lj_refCount: [], lj_ref_send: [], lj_quant: [], priceMin: '', priceMax: '' };
  let filtersConfig = {};

  // ─── Detection ───

  function canHandle() {
    const hasMpcard = typeof mpcard !== 'undefined';
    const hasCardStock = typeof cards_stock !== 'undefined' && Array.isArray(cards_stock) && cards_stock.length > 0;
    if (hasMpcard && hasCardStock) return true;

    const hasMpproduct = typeof mpproduct !== 'undefined';
    const hasProdStock = typeof prod_stock !== 'undefined' && Array.isArray(prod_stock) && prod_stock.length > 0;
    if (hasMpproduct && hasProdStock) return true;

    return false;
  }

  // ─── Label Helpers ───

  const QUALITY_LABELS = C.QUALITY_LABELS;

  function getQualityLabel(id) {
    if (String(id) === '0') return 'Não especificado';
    // Product pages have their own quality labels (Aberto, Lacrado, Novo...)
    if (!isProduct && QUALITY_LABELS[id]) return QUALITY_LABELS[id];
    if (typeof dataQuality !== 'undefined' && Array.isArray(dataQuality)) {
      const q = dataQuality.find(d => String(d.id) === String(id));
      if (q) return q.label;
    }
    return 'Q' + id;
  }

  function getLanguageLabel(id) {
    if (String(id) === '0') return 'Não especificado';
    if (typeof dataLanguage !== 'undefined' && Array.isArray(dataLanguage)) {
      const l = dataLanguage.find(d => String(d.id) === String(id));
      if (l) return l.label;
    }
    const fallback = { 1: 'Alemão', 2: 'Inglês', 3: 'Espanhol', 4: 'Francês', 5: 'Italiano', 6: 'Japonês', 7: 'Coreano', 8: 'Português', 9: 'Russo', 10: 'Chinês Trad.', 11: 'PT/EN', 12: 'Chinês Simp.', 16: 'Phyrexiano' };
    return fallback[id] || 'L' + id;
  }

  function getExtrasLabel(id) {
    const sid = String(id);
    if (sid === '0' || sid === '') return 'Normal / Sem Extras';
    if (typeof dataExtras !== 'undefined' && Array.isArray(dataExtras)) {
      const e = dataExtras.find(d => String(d.id) === sid);
      if (e) return e.label;
    }
    const fallback = { 2: 'Foil', 3: 'Promo', 5: 'Pre Release', 7: 'FNM', 10: 'Pre Release Foil', 11: 'DCI', 13: 'Textless', 17: 'Assinada', 19: 'Buy A Box', 23: 'Oversize', 29: 'Alterada', 31: 'Foil Especial', 37: 'Misprint', 41: 'Miscut' };
    return fallback[sid] || 'Extras ' + sid;
  }

  // Product pages use lj_rastreio (1=fastest, 2=medium, etc.)
  const SEND_LABELS_PRODUCT = {
    '1': 'Até 2 dias úteis',
    '2': 'De 3 à 5 dias úteis',
    '3': 'De 6 à 10 dias úteis',
    '4': 'Mais de 10 dias úteis'
  };

  function getSendLabel(rating) {
    if (isProduct && SEND_LABELS_PRODUCT[String(rating)]) {
      return SEND_LABELS_PRODUCT[String(rating)];
    }
    const r = parseFloat(rating);
    if (r >= 5) return 'Até 2 dias úteis';
    if (r >= 4) return 'Até 3 dias úteis';
    if (r >= 3) return 'Até 5 dias úteis';
    if (r >= 2) return 'Até 7 dias úteis';
    return 'Mais de 7 dias úteis';
  }

  function getEditionLabel(id) {
    if (String(id) === '0') return 'Não especificado';
    if (initEditions && Array.isArray(initEditions)) {
      const ed = initEditions.find(e => String(e.id) === String(id));
      if (ed) return ed.name;
    }
    return 'Ed.' + id;
  }

  // ─── Filter State ───

  function hasActive() {
    return activeFilters.qualid.length > 0 || activeFilters.idioma.length > 0 ||
      activeFilters.extras.length > 0 || activeFilters.edicao.length > 0 ||
      activeFilters.num.length > 0 || activeFilters.lj_uf.length > 0 ||
      activeFilters.lj_tipo.length > 0 || activeFilters.lj_ref.length > 0 ||
      activeFilters.lj_refCount.length > 0 || activeFilters.lj_ref_send.length > 0 || activeFilters.lj_quant.length > 0 ||
      activeFilters.priceMin !== '' || activeFilters.priceMax !== '';
  }

  // ─── Enrich Stock Items ───

  function enrichStock() {
    // Detect buylist: items have nested q/l objects for quality/language discounts
    isBuylist = allStock.length > 0 && allStock[0].q && typeof allStock[0].q === 'object';

    allStock.forEach(item => {
      const store = initStores[String(item.lj_id)];
      if (store) {
        item._fav = store.lj_fav;
        item._fisica = store.lj_fisica;
        item._selo = store.lj_selo;
        item._cidade = store.lj_cidade;
        item._storeName = store.lj_name;
        item._refAvg = store.lj_ref;
        item._refSend = store.lj_ref_send !== undefined && store.lj_ref_send !== null
          ? String(parseFloat(store.lj_ref_send))
          : undefined;
      }
      // Product pages: send time comes from lj_rastreio on the stock item, not store
      if (isProduct && item.lj_rastreio) {
        item._refSend = String(item.lj_rastreio);
      }
      // On bazar pages (no stores), lj_ref on items is a review COUNT, not a rating.
      // Only use lj_ref as _refAvg fallback when stores exist (buylist pages where lj_ref is a rating).
      const hasStoreData = Object.keys(initStores).length > 0;
      if (hasStoreData && item._refAvg === undefined && item.lj_ref !== undefined) {
        const ref = parseFloat(item.lj_ref);
        if (ref >= 1 && ref <= 5) item._refAvg = item.lj_ref;
      }
      // Reference count (bazar pages: lj_ref is review count, not rating)
      item._refCount = (item.lj_ref !== undefined && item.lj_ref !== null) ? Number(item.lj_ref) : 0;
      item._quant = (item.quantFilter !== undefined && item.quantFilter !== null) ? Number(item.quantFilter) : 1;

      // Buylist: extract accepted qualities/languages from q/l objects
      if (isBuylist) {
        item._qualities = item.q ? Object.keys(item.q) : [];
        item._languages = item.l ? Object.keys(item.l) : [];
      }
    });
  }

  // ─── Detect mpline prefix ───

  function detectMplinePrefix() {
    const container = document.getElementById('marketplace-stores');
    if (!container || !container.firstElementChild) return;
    const firstId = container.firstElementChild.id || '';
    const match = firstId.match(/^mpline_(\d+)_/);
    if (match) mplinePrefix = 'mpline_' + match[1] + '_';
  }

  // ─── Extract Filter Options ───

  function extractFilterOptions() {
    filtersConfig = {};

    if (isBuylist) {
      const qualIds = [...new Set(allStock.flatMap(s => s._qualities))].sort((a, b) => parseInt(a) - parseInt(b));
      if (qualIds.length > 0) {
        filtersConfig.qualid = {
          label: isProduct ? 'Condição' : 'Qualidade', options: qualIds.map(v => ({
            id: v, label: getQualityLabel(v), count: allStock.filter(s => s._qualities.includes(v)).length
          }))
        };
      }
    } else {
      const qualVals = [...new Set(allStock.map(s => String(s.qualid)).filter(v => v && v !== 'undefined'))].sort((a, b) => parseInt(a) - parseInt(b));
      if (qualVals.length > 0) {
        filtersConfig.qualid = {
          label: isProduct ? 'Condição' : 'Qualidade', options: qualVals.map(v => ({
            id: v, label: getQualityLabel(v), count: allStock.filter(s => String(s.qualid) === v).length
          }))
        };
      }
    }

    if (isBuylist) {
      const langIds = [...new Set(allStock.flatMap(s => s._languages))].filter(v => v !== '0').sort((a, b) => parseInt(a) - parseInt(b));
      if (langIds.length > 0) {
        filtersConfig.idioma = {
          label: 'Idioma', options: langIds.map(v => ({
            id: v, label: getLanguageLabel(v), count: allStock.filter(s => s._languages.includes(v)).length
          }))
        };
      }
    } else {
      const langVals = [...new Set(allStock.map(s => String(s.idioma)).filter(v => v && v !== 'undefined'))].sort((a, b) => parseInt(a) - parseInt(b));
      if (langVals.length > 0) {
        filtersConfig.idioma = {
          label: 'Idioma', options: langVals.map(v => ({
            id: v, label: getLanguageLabel(v), count: allStock.filter(s => String(s.idioma) === v).length
          }))
        };
      }
    }

    // Extras (not available on product pages)
    if (!isProduct) {
      const extraRaw = allStock.map(s => s.extras === undefined || s.extras === null ? 0 : s.extras);
      const extraVals = [...new Set(extraRaw.map(String))].sort((a, b) => parseInt(a) - parseInt(b));
      if (extraVals.length > 0) {
        filtersConfig.extras = {
          label: 'Extras', options: extraVals.map(v => ({
            id: v, label: getExtrasLabel(v), count: allStock.filter(s => String(s.extras === undefined || s.extras === null ? 0 : s.extras) === v).length
          }))
        };
      }
    }

    const edVals = [...new Set(allStock.map(s => String(s.idEdicao)).filter(v => v && v !== 'undefined'))];
    if (edVals.length > 1) {
      filtersConfig.edicao = {
        label: 'Edição', options: edVals.map(v => ({
          id: v, label: getEditionLabel(v), count: allStock.filter(s => String(s.idEdicao) === v).length
        })).sort((a, b) => a.label.localeCompare(b.label))
      };
    }

    const numVals = [...new Set(allStock.map(s => s.num).filter(v => v && v !== 'undefined'))].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return (isNaN(na) ? 999999 : na) - (isNaN(nb) ? 999999 : nb);
    });
    if (numVals.length > 1) {
      filtersConfig.num = {
        label: 'Numeração', options: numVals.map(v => ({
          id: v, label: '#' + v, count: allStock.filter(s => s.num === v).length
        }))
      };
    }

    // --- Store filters ---

    const ufVals = [...new Set(allStock.map(s => s.lj_uf).filter(v => v && v.trim()))].sort();
    if (ufVals.length > 1) {
      filtersConfig.lj_uf = {
        label: 'Estado', options: ufVals.map(v => ({
          id: v, label: (C.UF_NAMES[v] || v) + ' (' + v + ')', count: allStock.filter(s => s.lj_uf === v).length
        }))
      };
    }

    // Tipo de Loja (skip on bazar pages where there are no stores)
    const hasStores = Object.keys(initStores).length > 0;
    if (hasStores) {
      const tipoOptions = [];
      const countFav = allStock.filter(s => s._fav === 1).length;
      const countFisica = allStock.filter(s => s._fisica === 1).length;
      const countVerif = allStock.filter(s => s._selo !== undefined && s._selo >= 2).length;
      const countNVerif = allStock.filter(s => s._selo === undefined || s._selo < 2).length;
      if (countFav > 0) tipoOptions.push({ id: 'fav', label: 'Favoritas', count: countFav });
      if (countFisica > 0) tipoOptions.push({ id: 'fisica', label: 'Com Loja Física', count: countFisica });
      if (countVerif > 0) tipoOptions.push({ id: 'verificada', label: 'Loja Verificada', count: countVerif });
      if (countNVerif > 0) tipoOptions.push({ id: 'nverificada', label: 'Não Verificada', count: countNVerif });
      if (tipoOptions.length > 0) {
        filtersConfig.lj_tipo = { label: 'Tipo de Loja', options: tipoOptions };
      }
    }

    // Referências — range-based filter for bazar pages (lj_ref = review count)
    if (!hasStores) {
      const REF_RANGES = [
        { id: '100', label: '100 ou mais', min: 100, max: Infinity },
        { id: '50', label: '50 - 99', min: 50, max: 99 },
        { id: '10', label: '10 - 49', min: 10, max: 49 },
        { id: '0', label: 'Até 9', min: 0, max: 9 }
      ];
      const refCountOptions = [];
      for (const range of REF_RANGES) {
        const count = allStock.filter(s => s._refCount >= range.min && s._refCount <= range.max).length;
        if (count > 0) refCountOptions.push({ id: range.id, label: range.label, count: count });
      }
      if (refCountOptions.length > 0) {
        filtersConfig.lj_refCount = { label: 'Referências', options: refCountOptions };
      }
    }

    const refVals = [...new Set(allStock.map(s => {
      if (s._refAvg === undefined || s._refAvg === null) return null;
      return String(parseFloat(s._refAvg));
    }).filter(v => v !== null))].sort((a, b) => parseFloat(b) - parseFloat(a));
    if (refVals.length > 0) {
      filtersConfig.lj_ref = {
        label: 'Média de Avaliações', isRating: true, options: refVals.map(v => {
          const n = Math.max(0, Math.min(5, Math.round(parseFloat(v))));
          const stars = '<span class="le-stars">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>';
          return {
            id: v, label: stars, count: allStock.filter(s => s._refAvg !== undefined && s._refAvg !== null && String(parseFloat(s._refAvg)) === v).length
          };
        })
      };
    }

    const sendVals = [...new Set(allStock.map(s => s._refSend).filter(v => v !== undefined && v !== null))].sort((a, b) => parseFloat(b) - parseFloat(a));
    if (sendVals.length > 0) {
      filtersConfig.lj_ref_send = {
        label: 'Tempo médio para envio', options: sendVals.map(v => ({
          id: v, label: getSendLabel(v), count: allStock.filter(s => s._refSend === v).length
        }))
      };
    }

    // Quantidade — modulo comparison like native screenfilter
    const quantThresholds = [4, 3, 2];
    const quantOptions = [];
    for (const q of quantThresholds) {
      const count = allStock.filter(s => s._quant > 0 && s._quant % q === 0).length;
      if (count > 0) {
        quantOptions.push({ id: String(q), label: q + ' ou mais unidades' });
      }
    }
    if (quantOptions.length > 0) {
      filtersConfig.lj_quant = { label: 'Quantidade', options: quantOptions, hideCount: true };
    }

    const prices = allStock.map(s => parseFloat(s.precoFinal)).filter(p => !isNaN(p) && p > 0);
    if (prices.length > 0) {
      filtersConfig.price = {
        min: Math.floor(Math.min(...prices)),
        max: Math.ceil(Math.max(...prices))
      };
    }
  }

  // ─── Build Panel HTML ───

  function buildHTML() {
    let html = '';

    html += '<div id="le-active-bar" class="le-active-bar" style="display:none;"></div>';
    html += '<div class="le-results-bar"><span id="le-results-count">' + allStock.length + '</span> / ' + allStock.length + ' itens <button id="le-clear-all" class="le-clear-btn" style="display:none;">Limpar</button></div>';

    html += '<div class="le-group-title">Filtros do Produto</div>';
    if (filtersConfig.qualid) html += ui.buildChipSection('qualid', filtersConfig.qualid);
    if (filtersConfig.idioma) html += ui.buildChipSection('idioma', filtersConfig.idioma);
    if (filtersConfig.extras) html += ui.buildChipSection('extras', filtersConfig.extras);
    if (filtersConfig.edicao) html += ui.buildSearchableList('edicao', filtersConfig.edicao);
    if (filtersConfig.num) html += ui.buildSearchableList('num', filtersConfig.num);

    if (filtersConfig.price) {
      html += '<div class="le-section" data-key="price">';
      html += '<div class="le-section-title">Faixa de Preço</div>';
      html += '<div class="le-price-row">';
      html += '<input type="number" id="le-price-min" class="le-input le-input-sm le-price-input" placeholder="Min (R$)" min="0" step="0.01">';
      html += '<span class="le-price-sep">—</span>';
      html += '<input type="number" id="le-price-max" class="le-input le-input-sm le-price-input" placeholder="Max (R$)" min="0" step="0.01">';
      html += '</div></div>';
    }

    html += '<div class="le-group-title">Filtros da Loja</div>';
    if (filtersConfig.lj_uf) html += ui.buildSearchableList('lj_uf', filtersConfig.lj_uf);
    if (filtersConfig.lj_tipo) html += ui.buildChipSection('lj_tipo', filtersConfig.lj_tipo);
    if (filtersConfig.lj_refCount) html += ui.buildChipSection('lj_refCount', filtersConfig.lj_refCount);
    if (filtersConfig.lj_ref) html += ui.buildChipSection('lj_ref', filtersConfig.lj_ref);
    if (filtersConfig.lj_ref_send) html += ui.buildChipSection('lj_ref_send', filtersConfig.lj_ref_send);
    if (filtersConfig.lj_quant) html += ui.buildChipSection('lj_quant', filtersConfig.lj_quant);

    return html;
  }

  // ─── Bind Events ───

  function bindEvents(panel) {
    panel.querySelectorAll('.le-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.key;
        const val = chip.dataset.val;
        const arr = activeFilters[key];
        const idx = arr.indexOf(val);
        if (idx === -1) arr.push(val); else arr.splice(idx, 1);
        chip.classList.toggle('le-chip-on');
        applyFilters();
      });
    });

    ['edicao', 'num', 'lj_uf'].forEach(k => {
      panel.querySelectorAll('.le-cb[data-key="' + k + '"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const val = cb.dataset.val;
          if (cb.checked) { if (!activeFilters[k].includes(val)) activeFilters[k].push(val); }
          else { activeFilters[k] = activeFilters[k].filter(v => v !== val); }
          ui.reorderList(k);
          applyFilters();
        });
      });
    });

    ui.bindListSearch(panel);

    const priceMin = panel.querySelector('#le-price-min');
    const priceMax = panel.querySelector('#le-price-max');
    let priceTimer;
    const onPriceChange = () => {
      clearTimeout(priceTimer);
      priceTimer = setTimeout(() => {
        activeFilters.priceMin = priceMin ? priceMin.value : '';
        activeFilters.priceMax = priceMax ? priceMax.value : '';
        applyFilters();
      }, 400);
    };
    if (priceMin) priceMin.addEventListener('input', onPriceChange);
    if (priceMax) priceMax.addEventListener('input', onPriceChange);

    panel.querySelector('#le-clear-all').addEventListener('click', clearAll);
  }

  // ─── Clear ───

  function clearAll() {
    activeFilters = { qualid: [], idioma: [], extras: [], edicao: [], num: [], lj_uf: [], lj_tipo: [], lj_ref: [], lj_refCount: [], lj_ref_send: [], lj_quant: [], priceMin: '', priceMax: '' };
    const panel = document.getElementById('le-panel');
    if (!panel) return;
    panel.querySelectorAll('.le-chip-on').forEach(c => c.classList.remove('le-chip-on'));
    panel.querySelectorAll('.le-cb').forEach(c => { c.checked = false; });
    const pMin = panel.querySelector('#le-price-min');
    const pMax = panel.querySelector('#le-price-max');
    if (pMin) pMin.value = '';
    if (pMax) pMax.value = '';
    applyFilters();
  }

  // ─── Filter Matching ───

  function getItemValue(item, key) {
    if (key === 'extras') return String(item.extras === undefined || item.extras === null ? 0 : item.extras);
    if (key === 'edicao') return String(item.idEdicao);
    if (key === 'num') return String(item.num);
    return String(item[key]);
  }

  const REF_RANGE_MAP = { '100': [100, Infinity], '50': [50, 99], '10': [10, 49], '0': [0, 9] };

  function matchesRefRange(refCount, rangeId) {
    const range = REF_RANGE_MAP[rangeId];
    return range && refCount >= range[0] && refCount <= range[1];
  }

  function matchesTipo(item, tipoVal) {
    if (tipoVal === 'fav') return item._fav === 1;
    if (tipoVal === 'fisica') return item._fisica === 1;
    if (tipoVal === 'verificada') return item._selo !== undefined && item._selo >= 2;
    if (tipoVal === 'nverificada') return item._selo === undefined || item._selo < 2;
    return true;
  }

  function matchesFilters(item) {
    if (activeFilters.qualid.length > 0) {
      if (isBuylist) {
        if (!activeFilters.qualid.some(q => item._qualities.includes(q))) return false;
      } else {
        if (!activeFilters.qualid.includes(String(item.qualid))) return false;
      }
    }
    if (activeFilters.idioma.length > 0) {
      if (isBuylist) {
        if (!activeFilters.idioma.some(l => item._languages.includes(l))) return false;
      } else {
        if (!activeFilters.idioma.includes(String(item.idioma))) return false;
      }
    }
    if (activeFilters.extras.length > 0) {
      const itemExtras = String(item.extras === undefined || item.extras === null ? 0 : item.extras);
      if (!activeFilters.extras.includes(itemExtras)) return false;
    }
    if (activeFilters.edicao.length > 0 && !activeFilters.edicao.includes(String(item.idEdicao))) return false;
    if (activeFilters.num.length > 0 && !activeFilters.num.includes(String(item.num))) return false;
    if (activeFilters.lj_uf.length > 0 && !activeFilters.lj_uf.includes(item.lj_uf)) return false;
    if (activeFilters.lj_tipo.length > 0) {
      if (!activeFilters.lj_tipo.some(t => matchesTipo(item, t))) return false;
    }
    if (activeFilters.lj_ref.length > 0) {
      const normalized = item._refAvg !== undefined && item._refAvg !== null ? String(parseFloat(item._refAvg)) : '';
      if (!activeFilters.lj_ref.includes(normalized)) return false;
    }
    if (activeFilters.lj_refCount.length > 0) {
      if (!activeFilters.lj_refCount.some(r => matchesRefRange(item._refCount, r))) return false;
    }
    if (activeFilters.lj_ref_send.length > 0 && !activeFilters.lj_ref_send.includes(item._refSend)) return false;
    if (activeFilters.lj_quant.length > 0) {
      const matchesAny = activeFilters.lj_quant.some(q => item._quant > 0 && item._quant % Number(q) === 0);
      if (!matchesAny) return false;
    }
    const pMin = activeFilters.priceMin !== '' ? parseFloat(activeFilters.priceMin) : null;
    const pMax = activeFilters.priceMax !== '' ? parseFloat(activeFilters.priceMax) : null;
    if (pMin !== null || pMax !== null) {
      const price = parseFloat(item.precoFinal);
      if (pMin !== null && price < pMin) return false;
      if (pMax !== null && price > pMax) return false;
    }
    return true;
  }

  // ─── Pagination Control ───

  let allExpanded = false;

  function expandAll(callback) {
    if (allExpanded) { callback(); return; }
    if (typeof screenfilter !== 'undefined') {
      screenfilter.ignorePagination = 1;
      if (typeof screenfilter.search === 'function') {
        screenfilter.search(0);
      }
      if (typeof layerBlocker === 'function') {
        setTimeout(function () { layerBlocker(false); }, 50);
      }
    }
    allExpanded = true;
    setTimeout(function () {
      detectMplinePrefix();
      callback();
    }, 100);
  }

  function restorePagination() {
    if (!allExpanded) return;
    allExpanded = false;
    if (typeof screenfilter !== 'undefined') {
      screenfilter.ignorePagination = 0;
      if (typeof screenfilter.search === 'function') {
        screenfilter.search(0);
      }
      if (typeof layerBlocker === 'function') {
        setTimeout(function () { layerBlocker(false); }, 50);
      }
    }
  }

  // ─── Apply Filters ───

  function applyFilters() {
    if (!hasActive()) {
      restorePagination();
      document.querySelectorAll('.screenfilter-list-filters').forEach(el => {
        el.style.pointerEvents = '';
        el.style.opacity = '';
      });
      const countEl = document.getElementById('le-results-count');
      if (countEl) countEl.textContent = allStock.length;
      const clearBtn = document.getElementById('le-clear-all');
      if (clearBtn) clearBtn.style.display = 'none';
      updateActiveBar();
      updateCounts();
      return;
    }

    expandAll(function () {
      const filtered = allStock.filter(matchesFilters);
      const filteredIds = new Set(filtered.map(s => String(s.id)));

      let visible = 0;
      let missing = 0;
      allStock.forEach(item => {
        const el = document.getElementById(mplinePrefix + item.id);
        if (el) {
          if (filteredIds.has(String(item.id))) {
            el.style.display = '';
            visible++;
          } else {
            el.style.display = 'none';
          }
        } else {
          missing++;
        }
      });

      const loadMore = document.getElementById('marketplace-stores-loadmore');
      if (loadMore) loadMore.style.display = 'none';

      const countEl = document.getElementById('le-results-count');
      if (countEl) countEl.textContent = filtered.length;

      const clearBtn = document.getElementById('le-clear-all');
      if (clearBtn) clearBtn.style.display = 'inline-block';

      updateActiveBar();
      updateCounts();

      document.querySelectorAll('.screenfilter-list-filters').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.5';
      });

    });
  }

  // ─── Update Counts (cross-filter) ───

  function updateCounts() {
    const panel = document.getElementById('le-panel');
    if (!panel) return;

    const chipKeys = ['qualid', 'idioma', 'extras', 'lj_tipo', 'lj_ref', 'lj_refCount', 'lj_ref_send', 'lj_quant'];
    const listKeys = ['edicao', 'num', 'lj_uf'];
    const allKeys = [...chipKeys, ...listKeys];

    for (const key of allKeys) {
      if (!filtersConfig[key]) continue;

      const others = allStock.filter(item => {
        for (const ok of allKeys) {
          if (ok === key) continue;
          if (activeFilters[ok].length > 0) {
            if (ok === 'lj_tipo') {
              if (!activeFilters[ok].some(t => matchesTipo(item, t))) return false;
            } else if (ok === 'lj_quant') {
              const matchesAnyQ = activeFilters[ok].some(q => item._quant > 0 && item._quant % Number(q) === 0);
              if (!matchesAnyQ) return false;
            } else if (ok === 'lj_ref') {
              const norm = item._refAvg !== undefined && item._refAvg !== null ? String(parseFloat(item._refAvg)) : '';
              if (!activeFilters[ok].includes(norm)) return false;
            } else if (ok === 'lj_refCount') {
              if (!activeFilters[ok].some(r => matchesRefRange(item._refCount, r))) return false;
            } else if (ok === 'lj_ref_send') {
              if (!activeFilters[ok].includes(item._refSend)) return false;
            } else if (isBuylist && ok === 'qualid') {
              if (!activeFilters[ok].some(q => item._qualities.includes(q))) return false;
            } else if (isBuylist && ok === 'idioma') {
              if (!activeFilters[ok].some(l => item._languages.includes(l))) return false;
            } else {
              if (!activeFilters[ok].includes(getItemValue(item, ok))) return false;
            }
          }
        }
        const pMin = activeFilters.priceMin !== '' ? parseFloat(activeFilters.priceMin) : null;
        const pMax = activeFilters.priceMax !== '' ? parseFloat(activeFilters.priceMax) : null;
        if (pMin !== null || pMax !== null) {
          const price = parseFloat(item.precoFinal);
          if (pMin !== null && price < pMin) return false;
          if (pMax !== null && price > pMax) return false;
        }
        return true;
      });

      if (chipKeys.includes(key)) {
        panel.querySelectorAll('.le-chip[data-key="' + key + '"]').forEach(chip => {
          const val = chip.dataset.val;
          let count;
          if (key === 'lj_tipo') count = others.filter(s => matchesTipo(s, val)).length;
          else if (key === 'lj_ref') count = others.filter(s => s._refAvg !== undefined && s._refAvg !== null && String(parseFloat(s._refAvg)) === val).length;
          else if (key === 'lj_refCount') count = others.filter(s => matchesRefRange(s._refCount, val)).length;
          else if (key === 'lj_ref_send') count = others.filter(s => s._refSend === val).length;
          else if (key === 'lj_quant') {
            const q = parseInt(val);
            count = others.filter(s => s._quant > 0 && s._quant % q === 0).length;
          }
          else if (isBuylist && key === 'qualid') count = others.filter(s => s._qualities.includes(val)).length;
          else if (isBuylist && key === 'idioma') count = others.filter(s => s._languages.includes(val)).length;
          else count = others.filter(s => getItemValue(s, key) === val).length;
          const qtyEl = chip.querySelector('.le-chip-qty');
          if (qtyEl) qtyEl.textContent = count;
          chip.classList.toggle('le-chip-zero', count === 0 && !chip.classList.contains('le-chip-on'));
        });
      }

      if (listKeys.includes(key)) {
        const list = document.getElementById('le-list-' + key);
        if (list) {
          list.querySelectorAll('.le-artist-row').forEach(row => {
            const val = row.querySelector('.le-cb')?.dataset.val;
            if (!val) return;
            const count = others.filter(s => getItemValue(s, key) === val).length;
            row.querySelector('.le-artist-qty').textContent = count;
            row.classList.toggle('le-artist-zero', count === 0);
          });
        }
      }

      const badge = document.getElementById('le-badge-' + key);
      if (badge) { const n = activeFilters[key].length; badge.textContent = n > 0 ? n : ''; }
    }
  }

  // ─── Active Filter Bar ───

  function updateActiveBar() {
    const bar = document.getElementById('le-active-bar');
    if (!bar) return;
    const tags = [];

    const labelMap = { qualid: getQualityLabel, idioma: getLanguageLabel, extras: getExtrasLabel };
    for (const key of ['qualid', 'idioma', 'extras']) {
      for (const val of activeFilters[key]) tags.push({ key, val, label: labelMap[key](val) });
    }
    const tipoLabels = { fav: 'Favoritas', fisica: 'Com Loja Física', verificada: 'Loja Verificada', nverificada: 'Não Verificada' };
    for (const val of activeFilters.lj_tipo) tags.push({ key: 'lj_tipo', val, label: tipoLabels[val] || val });
    for (const val of activeFilters.lj_ref) {
      const n = Math.max(0, Math.min(5, Math.round(parseFloat(val))));
      tags.push({ key: 'lj_ref', val, label: '★'.repeat(n) + '☆'.repeat(5 - n) });
    }
    const refRangeLabels = { '100': '100 ou mais', '50': '50 - 99', '10': '10 - 49', '0': 'Até 9' };
    for (const val of activeFilters.lj_refCount) tags.push({ key: 'lj_refCount', val, label: refRangeLabels[val] || val });
    for (const val of activeFilters.lj_ref_send) tags.push({ key: 'lj_ref_send', val, label: getSendLabel(val) });
    for (const val of activeFilters.lj_quant) tags.push({ key: 'lj_quant', val, label: val + ' ou mais unidades' });
    for (const val of activeFilters.edicao) tags.push({ key: 'edicao', val, label: getEditionLabel(val) });
    for (const val of activeFilters.num) tags.push({ key: 'num', val, label: '#' + val });
    for (const val of activeFilters.lj_uf) tags.push({ key: 'lj_uf', val, label: val });
    if (activeFilters.priceMin) tags.push({ key: 'priceMin', val: activeFilters.priceMin, label: 'Min R$' + activeFilters.priceMin });
    if (activeFilters.priceMax) tags.push({ key: 'priceMax', val: activeFilters.priceMax, label: 'Max R$' + activeFilters.priceMax });

    if (!tags.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    bar.style.display = 'flex';
    bar.innerHTML = tags.map(t => {
      const v = String(t.val).replace(/"/g, '&quot;');
      return '<span class="le-tag" data-key="' + t.key + '" data-val="' + v + '">' + t.label + ' &times;</span>';
    }).join('');

    bar.querySelectorAll('.le-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const k = tag.dataset.key, v = tag.dataset.val;
        if (k === 'priceMin') { activeFilters.priceMin = ''; const el = document.getElementById('le-price-min'); if (el) el.value = ''; }
        else if (k === 'priceMax') { activeFilters.priceMax = ''; const el = document.getElementById('le-price-max'); if (el) el.value = ''; }
        else {
          activeFilters[k] = activeFilters[k].filter(x => x !== v);
          const chip = document.querySelector('#le-panel .le-chip[data-key="' + k + '"][data-val="' + v + '"]');
          if (chip) chip.classList.remove('le-chip-on');
          const cb = document.querySelector('#le-panel .le-cb[data-key="' + k + '"][data-val="' + v.replace(/"/g, '\\"') + '"]');
          if (cb) { cb.checked = false; ui.reorderList(k); }
        }
        applyFilters();
      });
    });
  }

  // ─── Register Module ───

  LE.registerModule({
    name: 'mpcard',
    canHandle: canHandle,
    init: function () {
      isProduct = typeof mpproduct !== 'undefined' && typeof prod_stock !== 'undefined';

      const stock = isProduct
        ? (typeof prod_stock !== 'undefined' ? prod_stock : [])
        : (typeof cards_stock !== 'undefined' ? cards_stock : []);
      const eds = typeof cards_editions !== 'undefined' ? cards_editions : [];
      const stores = isProduct
        ? ((typeof prod_stores !== 'undefined' && prod_stores) ? prod_stores : {})
        : ((typeof cards_stores !== 'undefined' && cards_stores) ? cards_stores : {});

      allStock = [...stock];
      initEditions = eds;
      initStores = stores;

      enrichStock();
      extractFilterOptions();
      ui.createFloatingButton();
      const panel = ui.createPanelShell(buildHTML());
      bindEvents(panel);

      const waitForRender = () => {
        const container = document.getElementById('marketplace-stores');
        if (container && container.children.length > 0) {
          detectMplinePrefix();
        } else {
          setTimeout(waitForRender, 500);
        }
      };
      setTimeout(waitForRender, 1000);

    }
  });
})();
