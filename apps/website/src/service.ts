/**
 * Ce que le service dit de lui-même.
 *
 * Une seule question pour l'instant : les offres s'appliquent-elles ? Elle
 * décide de l'affichage du prix, du bouton d'abonnement, du choix d'offre à
 * l'inscription et de la publication des conditions de vente.
 *
 * La réponse vient du serveur et de nulle part ailleurs. Un second réglage
 * côté site finirait par ne plus dire la même chose que lui, et le jour où ça
 * arriverait, le site annoncerait un prix pour un abonnement impossible à
 * prendre — ou l'inverse.
 *
 * Par défaut **fermé** : si le service ne répond pas, on n'annonce ni prix ni
 * conditions de vente. Se tromper dans ce sens-là ne coûte qu'un lien absent.
 */

import { reactive } from "vue";
import { fetchPlans, type PlanInfo } from "@/account";
import { DEFAULT_ENDPOINT } from "@/sync";

const FALLBACK: PlanInfo = {
  plansEnforced: false,
  priceMonthlyCents: 200,
  currency: "EUR",
  billingAvailable: false,
  freeMaxEntries: 20,
  freeMaxDevices: 2,
  proMaxEntries: 2000,
  proMaxDevices: 20,
};

export const service = reactive({
  plans: { ...FALLBACK },
  loaded: false,
});

let pending: Promise<void> | null = null;

/**
 * Oublie ce qui a été lu, pour relire.
 *
 * Utile aux tests, qui montent plusieurs fois la même page devant des
 * services différents : sans cela, la première réponse vaudrait pour toutes
 * les suivantes.
 */
export function resetService(): void {
  service.plans = { ...FALLBACK };
  service.loaded = false;
  pending = null;
}

/** Interroge le service une fois par chargement de page, pas par composant. */
export function loadService(): Promise<void> {
  if (pending) return pending;

  pending = fetchPlans(DEFAULT_ENDPOINT)
    .then((plans) => {
      service.plans = plans;
      service.loaded = true;
    })
    .catch(() => {
      // Le repli reste en place : ni prix annoncé, ni conditions publiées.
      service.loaded = true;
    });

  return pending;
}
