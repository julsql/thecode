/**
 * Transfert du carnet : QR code pour aller vers un telephone, fichier pour
 * aller vers un autre navigateur.
 *
 * Tout passe par le service worker : la clef maitresse ne descend jamais
 * jusqu'a cette page, et le chiffrement se fait la ou elle vit.
 */
if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}

translatePage();

const statusLine = document.getElementById("status");
const qrBox = document.getElementById("qr");
const qrModules = document.getElementById("qrModules");

const QR_CYCLE_MS = 800;
let qrTimer = null;

function say(message) {
  statusLine.textContent = message;
}

function drawQr(modules) {
  qrModules.innerHTML = "";
  for (const row of modules) {
    const line = document.createElement("div");
    for (const module of row) {
      const cell = document.createElement("span");
      cell.className = module ? "dark" : "light";
      line.appendChild(cell);
    }
    qrModules.appendChild(line);
  }
}

/** Demande au service worker le carnet chiffre, pret a transporter. */
function requestPayload() {
  return new Promise((resolve) => {
    browser.runtime.sendMessage({ action: "exportVault" }, resolve);
  });
}

document.getElementById("showQr").addEventListener("click", async () => {
  say(msg("transfer_working", "Calcul en cours…"));
  const resp = await requestPayload();
  if (!resp?.ok) {
    qrBox.hidden = true;
    say(
      msg("transfer_failed", "Impossible : $1", resp?.error || msg("transfer_unknown", "inconnu")),
    );
    return;
  }

  clearInterval(qrTimer);
  try {
    // Au-dela d'un QR, les fragments TC2m defilent en boucle : le lecteur
    // les accumule jusqu'a les avoir tous (shared/spec/vault-transfer.md).
    const codes = splitPayload(resp.payload).map((code) => encodeQr(code).modules);
    let shown = 0;
    drawQr(codes[0]);
    if (codes.length > 1) {
      qrTimer = setInterval(() => {
        shown = (shown + 1) % codes.length;
        drawQr(codes[shown]);
      }, QR_CYCLE_MS);
    }
    qrBox.hidden = false;
    say("");
  } catch (e) {
    // Un carnet trop gros ne tient pas dans un QR : le dire plutot que
    // d'afficher un code tronque que rien ne saura lire.
    qrBox.hidden = true;
    say(msg("transfer_failed", "Impossible : $1", e.message));
  }
});

document.getElementById("download").addEventListener("click", async () => {
  const resp = await requestPayload();
  if (!resp?.ok) {
    say(
      msg("transfer_failed", "Impossible : $1", resp?.error || msg("transfer_unknown", "inconnu")),
    );
    return;
  }

  const url = URL.createObjectURL(new Blob([resp.payload], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = msg("transfer_file_name", "thecode-carnet.txt");
  link.click();
  URL.revokeObjectURL(url);
  say(msg("transfer_saved", "Fichier enregistré."));
});

document.getElementById("importFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = "";

  say(msg("transfer_reading", "Lecture en cours…"));
  const payload = (await file.text()).trim();

  browser.runtime.sendMessage({ action: "importVault", payload }, (resp) => {
    if (!resp?.ok) {
      say(
        msg(
          "transfer_failed",
          "Impossible : $1",
          resp?.error || msg("transfer_unknown", "inconnu"),
        ),
      );
      return;
    }
    say(
      resp.conflicts
        ? msg(
            "transfer_merged_conflicts",
            "Carnet fusionné : $1 entrées, $2 à vérifier.",
            resp.entries,
            resp.conflicts,
          )
        : msg("transfer_merged", "Carnet fusionné : $1 entrées.", resp.entries),
    );
  });
});
