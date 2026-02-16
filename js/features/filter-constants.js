// Liga Enhanced - Filter Constants
// Maps, icons, and reference data shared across filter modules
(function () {
  "use strict";

  window.LigaEnhanced = window.LigaEnhanced || {};

  window.LigaEnhanced.constants = {
    // ─── EDC Card Field Maps ───

    RARITY_MAP: {
      1: "Comum",
      2: "Incomum",
      3: "Rara",
      4: "Mítica",
      5: "Especial",
      6: "Token",
      7: "Dicas",
      8: "Fenômenos",
      9: "Planos",
      10: "Esquema",
      11: "Emblema",
      12: "Experiência",
      13: "Art Card",
    },

    COLOR_MAP: {
      2: "Preto",
      3: "Verde",
      4: "Terreno",
      5: "Multicolorido",
      6: "Vermelho",
      7: "Azul",
      8: "Branco",
      9: "Incolor",
      10: "Sem Def.",
    },

    TYPE_MAP: {
      1: "Criatura",
      2: "Planeswalker",
      3: "Encantamento",
      4: "Artefato",
      5: "Instantânea",
      6: "Feitiço",
      7: "Terreno",
      8: "Terreno Básico",
      9: "Tribal",
      21: "Criatura",
      26: "Batalha",
    },

    COLOR_HEX: {
      2: "#a48bb5",
      3: "#00a651",
      4: "#c4a55c",
      5: "#cfb53b",
      6: "#e03c31",
      7: "#0e68ab",
      8: "#f8f4e8",
      9: "#c0c0c0",
      10: "#888",
    },

    // MTG mana symbols as inline SVGs
    COLOR_ICON: {
      // White - Sun/Starburst
      8: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#f2e6a0"/><circle cx="50" cy="50" r="44" fill="#edd97d"/><g fill="#1a1a1a"><circle cx="50" cy="50" r="12"/><polygon points="50,14 54,36 50,32 46,36"/><polygon points="50,86 54,64 50,68 46,64"/><polygon points="14,50 36,46 32,50 36,54"/><polygon points="86,50 64,54 68,50 64,46"/><polygon points="24.5,24.5 41,38 36,37 38,41"/><polygon points="75.5,24.5 62,38 64,41 59,37"/><polygon points="24.5,75.5 38,62 37,59 41,64"/><polygon points="75.5,75.5 59,64 64,62 62,59"/></g></svg>',
      // Blue - Water droplet
      7: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#c0d8f0"/><circle cx="50" cy="50" r="44" fill="#a8cbe8"/><path d="M50 18C50 18 28 48 28 62c0 12.2 9.8 22 22 22s22-9.8 22-22C72 48 50 18 50 18z" fill="#1a1a1a"/></svg>',
      // Black - Skull
      2: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#c8b8c8"/><circle cx="50" cy="50" r="44" fill="#b8a0b8"/><g fill="#1a1a1a"><ellipse cx="50" cy="42" rx="24" ry="22"/><ellipse cx="38" cy="40" rx="7" ry="8" fill="#b8a0b8"/><ellipse cx="62" cy="40" rx="7" ry="8" fill="#b8a0b8"/><path d="M44 54c0 0-2 4 0 6 2-2 4-2 6-2 2 0 4 0 6 2 2-2 0-6 0-6" fill="#b8a0b8"/><rect x="38" y="62" width="6" height="16" rx="2"/><rect x="47" y="62" width="6" height="18" rx="2"/><rect x="56" y="62" width="6" height="16" rx="2"/></g></svg>',
      // Red - Flame/Fireball
      6: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#f0b0a0"/><circle cx="50" cy="50" r="44" fill="#e89888"/><path d="M50 16c0 0-8 14-8 20 0 4 2 6 2 6s-14 4-14 24c0 12 10 20 20 20s20-8 20-20c0-20-14-24-14-24s2-2 2-6c0-6-8-20-8-20zM50 76c-5.5 0-10-4.5-10-10 0-8 6-12 6-12s-1 2-1 4c0 2 1 4 5 4s5-2 5-4c0-2-1-4-1-4s6 4 6 12c0 5.5-4.5 10-10 10z" fill="#1a1a1a"/></svg>',
      // Green - Tree
      3: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a8d8a0"/><circle cx="50" cy="50" r="44" fill="#88c880"/><g fill="#1a1a1a"><ellipse cx="50" cy="38" rx="22" ry="20"/><rect x="46" y="56" width="8" height="20" rx="2"/><path d="M38 75c0 0 5-3 12-3s12 3 12 3" stroke="#1a1a1a" stroke-width="3" fill="none" stroke-linecap="round"/></g></svg>',
      // Colorless - Diamond
      9: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#e0dcd0"/><circle cx="50" cy="50" r="44" fill="#d0ccc0"/><path d="M50 16L26 50 50 84 74 50z" fill="#1a1a1a"/><path d="M50 16L26 50h48z" fill="#333"/></svg>',
      // Multicolor - Gold 5-pointed
      5: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#e8d070"/><circle cx="50" cy="50" r="44" fill="#d8c050"/><path d="M50 16l7 22h23l-19 14 8 23-19-14-19 14 8-23-19-14h23z" fill="#1a1a1a"/></svg>',
      // Land - Mountain silhouette
      4: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#d8ccb0"/><circle cx="50" cy="50" r="44" fill="#c8b898"/><path d="M18 72L38 32 50 48 62 28 82 72z" fill="#1a1a1a"/></svg>',
      // Unknown
      10: '<svg class="le-mana-icon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#ddd"/><circle cx="50" cy="50" r="44" fill="#ccc"/><text x="50" y="62" text-anchor="middle" font-size="40" font-weight="bold" fill="#666">?</text></svg>',
    },

    // ─── Quality Labels ───

    QUALITY_LABELS: {
      1: "(M) Nova",
      2: "(NM) Praticamente Nova",
      3: "(SP) Usada Levemente",
      4: "(MP) Usada Moderadamente",
      5: "(HP) Muito Usada",
      6: "(D) Danificada",
    },

    // ─── Brazilian States ───

    UF_NAMES: {
      AC: "Acre",
      AL: "Alagoas",
      AP: "Amapá",
      AM: "Amazonas",
      BA: "Bahia",
      CE: "Ceará",
      DF: "Distrito Federal",
      ES: "Espírito Santo",
      GO: "Goiás",
      MA: "Maranhão",
      MT: "Mato Grosso",
      MS: "Mato Grosso do Sul",
      MG: "Minas Gerais",
      PA: "Pará",
      PB: "Paraíba",
      PR: "Paraná",
      PE: "Pernambuco",
      PI: "Piauí",
      RJ: "Rio de Janeiro",
      RN: "Rio Grande do Norte",
      RS: "Rio Grande do Sul",
      RO: "Rondônia",
      RR: "Roraima",
      SC: "Santa Catarina",
      SP: "São Paulo",
      SE: "Sergipe",
      TO: "Tocantins",
    },
  };
})();
