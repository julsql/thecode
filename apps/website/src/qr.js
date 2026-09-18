/**
 * Encodeur de QR code, mode octet, correction d'erreur L.
 *
 * Ecrit a la main plutot que pris dans une bibliotheque : l'extension ne livre
 * que du code de ce depot, et ajouter du code tiers non audite contredirait
 * l'argument que la specification utilise deja pour refuser XChaCha20.
 *
 * Le niveau L est celui qui donne la plus grande capacite (2953 octets en
 * version 40) : le QR s'affiche sur un ecran, il n'est ni imprime ni abime.
 *
 * Verifie contre shared/vault-fixtures/qr-vectors.json, produit par un
 * encodeur independant. Une matrice qui differe d'un module ne se scanne pas.
 *
 * Reference : ISO/IEC 18004.
 */

// ------------------------------------------------------------ GF(256)

/**
 * Corps fini du Reed-Solomon, polynome primitif 0x11D.
 *
 * Tables d'exponentielles et de logarithmes : la multiplication devient une
 * addition d'exposants, ce qui evite de refaire la reduction a chaque produit.
 */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Polynome generateur du code de Reed-Solomon pour `degree` symboles. */
function generatorPolynomial(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Symboles de correction : le reste de la division polynomiale. */
function errorCorrection(data, ecLength) {
  const generator = generatorPolynomial(ecLength);
  const remainder = new Uint8Array(ecLength);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecLength - 1] = 0;
    for (let i = 0; i < ecLength; i++) {
      remainder[i] ^= gfMul(generator[i + 1], factor);
    }
  }
  return remainder;
}

// ------------------------------------------------- tables des versions

/**
 * Par version : [symboles de correction par bloc, blocs du groupe 1, donnees
 * par bloc du groupe 1, blocs du groupe 2, donnees par bloc du groupe 2].
 *
 * Niveau L uniquement. Une erreur de transcription ici ne se verrait qu'au
 * scan : c'est ce que la fixture partagee attrape.
 */
const BLOCKS_L = [
  [7, 1, 19, 0, 0],
  [10, 1, 34, 0, 0],
  [15, 1, 55, 0, 0],
  [20, 1, 80, 0, 0],
  [26, 1, 108, 0, 0],
  [18, 2, 68, 0, 0],
  [20, 2, 78, 0, 0],
  [24, 2, 97, 0, 0],
  [30, 2, 116, 0, 0],
  [18, 2, 68, 2, 69],
  [20, 4, 81, 0, 0],
  [24, 2, 92, 2, 93],
  [26, 4, 107, 0, 0],
  [30, 3, 115, 1, 116],
  [22, 5, 87, 1, 88],
  [24, 5, 98, 1, 99],
  [28, 1, 107, 5, 108],
  [30, 5, 120, 1, 121],
  [28, 3, 113, 4, 114],
  [28, 3, 107, 5, 108],
  [28, 4, 116, 4, 117],
  [28, 2, 111, 7, 112],
  [30, 4, 121, 5, 122],
  [30, 6, 117, 4, 118],
  [26, 8, 106, 4, 107],
  [28, 10, 114, 2, 115],
  [30, 8, 122, 4, 123],
  [30, 3, 117, 10, 118],
  [30, 7, 116, 7, 117],
  [30, 5, 115, 10, 116],
  [30, 13, 115, 3, 116],
  [30, 17, 115, 0, 0],
  [30, 17, 115, 1, 116],
  [30, 13, 115, 6, 116],
  [30, 12, 121, 7, 122],
  [30, 6, 121, 14, 122],
  [30, 17, 122, 4, 123],
  [30, 4, 122, 18, 123],
  [30, 20, 117, 4, 118],
  [30, 19, 118, 6, 119],
];

/** Centres des motifs d'alignement, a partir de la version 2. */
const ALIGNMENT = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

function dataCapacity(version) {
  const [ec, g1, d1, g2, d2] = BLOCKS_L[version - 1];
  return g1 * d1 + g2 * d2;
}

// ------------------------------------------------------- flux de bits

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
  toBytes() {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) bytes[i >> 3] |= 0x80 >> (i % 8);
    });
    return bytes;
  }
}

/** 8 bits de compteur jusqu'a la version 9, 16 au-dela. */
function charCountBits(version) {
  return version <= 9 ? 8 : 16;
}

function chooseVersion(byteLength) {
  for (let version = 1; version <= 40; version++) {
    const needed = 4 + charCountBits(version) + byteLength * 8;
    if (needed <= dataCapacity(version) * 8) return version;
  }
  throw new Error(`Contenu trop long pour un QR : ${byteLength} octets`);
}

function encodeData(bytes, version) {
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // mode octet
  buffer.put(bytes.length, charCountBits(version));
  for (const byte of bytes) buffer.put(byte, 8);

  const capacityBits = dataCapacity(version) * 8;
  // Terminateur : jusqu'a quatre zeros, tronque s'il ne reste pas la place.
  buffer.put(0, Math.min(4, capacityBits - buffer.length));
  while (buffer.length % 8 !== 0) buffer.put(0, 1);

  const data = Array.from(buffer.toBytes());
  // Remplissage alterne impose par la norme.
  for (let i = 0; data.length < dataCapacity(version); i++) {
    data.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return Uint8Array.from(data);
}

/**
 * Decoupe en blocs, calcule la correction, puis entrelace.
 *
 * L'entrelacement est ce qui rend le code resistant a une rayure : une tache
 * locale abime un octet de chaque bloc plutot que tout un bloc.
 */
function interleave(data, version) {
  const [ecLength, g1, d1, g2, d2] = BLOCKS_L[version - 1];

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < g1; i++) {
    blocks.push(data.slice(offset, offset + d1));
    offset += d1;
  }
  for (let i = 0; i < g2; i++) {
    blocks.push(data.slice(offset, offset + d2));
    offset += d2;
  }

  const ecBlocks = blocks.map((block) => errorCorrection(block, ecLength));

  const out = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecLength; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return Uint8Array.from(out);
}

// --------------------------------------------------------- la matrice

const RESERVED = 2; // module de service : ni donnee, ni masque

function emptyMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || x < 0 || y >= matrix.length || x >= matrix.length) continue;

      const onRing = (r === 0 || r === 6) && c >= 0 && c <= 6;
      const onSide = (c === 0 || c === 6) && r >= 0 && r <= 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[y][x] = onRing || onSide || inCore ? 1 : 0;
    }
  }
}

function placeAlignment(matrix, version) {
  const centres = ALIGNMENT[version - 1];
  for (const row of centres) {
    for (const col of centres) {
      // Les trois coins portent deja un motif de reperage.
      if (matrix[row][col] !== null) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const edge = Math.max(Math.abs(r), Math.abs(c));
          matrix[row + r][col + c] = edge === 1 ? 0 : 1;
        }
      }
    }
  }
}

function placeTiming(matrix) {
  for (let i = 8; i < matrix.length - 8; i++) {
    const value = i % 2 === 0 ? 1 : 0;
    if (matrix[6][i] === null) matrix[6][i] = value;
    if (matrix[i][6] === null) matrix[i][6] = value;
  }
}

function reserveFormat(matrix, version) {
  const size = matrix.length;
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = RESERVED;
    if (matrix[i][8] === null) matrix[i][8] = RESERVED;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = RESERVED;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = RESERVED;
  }
  // Module toujours noir, impose par la norme.
  matrix[size - 8][8] = 1;

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      matrix[row][size - 11 + col] = RESERVED;
      matrix[size - 11 + col][row] = RESERVED;
    }
  }
}

/** BCH : la redondance qui protege les bits de service eux-memes. */
function bch(value, generator, bits) {
  let remainder = value;
  for (let i = bits - 1; i >= 0; i--) {
    if ((remainder >> (i + degree(generator))) & 1) {
      remainder ^= generator << i;
    }
  }
  return remainder;
}

function degree(value) {
  let d = -1;
  while (value) {
    value >>= 1;
    d++;
  }
  return d;
}

function formatBits(mask) {
  // 01 = niveau L, suivi des trois bits de masque.
  const data = (0b01 << 3) | mask;
  const remainder = bch(data << 10, 0b10100110111, 5);
  return ((data << 10) | remainder) ^ 0b101010000010010;
}

function versionBits(version) {
  const remainder = bch(version << 12, 0b1111100100101, 6);
  return (version << 12) | remainder;
}

function placeFormat(matrix, mask) {
  const size = matrix.length;
  const bits = formatBits(mask);

  // Les bits de poids faible descendent la colonne 8, les autres parcourent la
  // ligne 8 : l'inverse donne une matrice coherente mais illisible.
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;

    // Copie autour du reperage haut-gauche.
    if (i < 6) matrix[i][8] = bit;
    else if (i === 6) matrix[7][8] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[8][7] = bit;
    else matrix[8][14 - i] = bit;

    // Seconde copie, pour rester lisible si un coin est abime.
    if (i < 8) matrix[8][size - 1 - i] = bit;
    else matrix[size - 15 + i][8] = bit;
  }
}

function placeVersion(matrix, version) {
  if (version < 7) return;
  const size = matrix.length;
  const bits = versionBits(version);

  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const row = Math.floor(i / 3);
    const col = i % 3;
    matrix[row][size - 11 + col] = bit;
    matrix[size - 11 + col][row] = bit;
  }
}

/** Parcours en zigzag, de droite a gauche, deux colonnes a la fois. */
function placeData(matrix, codewords) {
  const size = matrix.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    // La colonne 6 est une piste de synchronisation : on la saute.
    if (right === 6) right = 5;

    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (matrix[row][col] !== null) continue;
        const bit =
          bitIndex < codewords.length * 8
            ? (codewords[bitIndex >> 3] >> (7 - (bitIndex % 8))) & 1
            : 0;
        matrix[row][col] = bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * Note de penalite : plus elle est basse, plus le code se lit facilement.
 *
 * Les quatre regles viennent de la norme et visent les motifs qui trompent un
 * lecteur — longues plages uniformes, blocs pleins, faux motifs de reperage,
 * desequilibre global.
 */
function penalty(modules) {
  const size = modules.length;
  let score = 0;

  // Regle 1 : suites de cinq modules identiques ou plus.
  for (let i = 0; i < size; i++) {
    for (const line of [modules[i], modules.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Regle 2 : carres 2x2 d'une seule couleur.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Regle 3 : le motif 1:1:3:1:1 borde de blanc, qui imite un reperage.
  const patterns = [
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  ];
  for (let i = 0; i < size; i++) {
    const rows = [modules[i], modules.map((row) => row[i])];
    for (const line of rows) {
      for (let j = 0; j + 11 <= size; j++) {
        for (const pattern of patterns) {
          if (pattern.every((bit, k) => line[j + k] === bit)) score += 40;
        }
      }
    }
  }

  // Regle 4 : ecart a la moitie de modules noirs.
  const dark = modules.reduce((n, row) => n + row.reduce((m, v) => m + v, 0), 0);
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Construit le QR code d'un texte.
 *
 * Rend `{ version, mask, size, modules }`, `modules` etant un tableau de
 * lignes de 0 et de 1.
 */
function encodeQr(text) {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const codewords = interleave(encodeData(bytes, version), version);
  const size = 17 + version * 4;

  const base = emptyMatrix(size);
  placeFinder(base, 0, 0);
  placeFinder(base, 0, size - 7);
  placeFinder(base, size - 7, 0);
  placeAlignment(base, version);
  placeTiming(base);
  reserveFormat(base, version);

  const reserved = base.map((row) => row.map((v) => v === RESERVED || v !== null));
  placeData(base, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) =>
      row.map((v, c) => {
        const value = v === RESERVED ? 0 : v;
        return reserved[r][c] ? value : value ^ (MASKS[mask](r, c) ? 1 : 0);
      }),
    );
    placeFormat(candidate, mask);
    placeVersion(candidate, version);

    const score = penalty(candidate);
    if (best === null || score < best.score) best = { score, mask, modules: candidate };
  }

  return { version, mask: best.mask, size, modules: best.modules };
}

if (typeof module !== "undefined") {
  module.exports = { encodeQr, penalty, errorCorrection, chooseVersion, dataCapacity };
}
