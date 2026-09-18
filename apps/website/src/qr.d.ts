/**
 * Types de l'encodeur QR partagé.
 *
 * Le fichier source est du JavaScript commun à l'extension, qui ne passe par
 * aucun bundler : il ne peut donc pas être écrit en TypeScript. Ce fichier
 * décrit ce qu'il expose, sans le dupliquer.
 */

export interface QrCode {
  version: number;
  mask: number;
  size: number;
  /** Lignes de 0 et de 1, du haut vers le bas. */
  modules: number[][];
}

export function encodeQr(text: string): QrCode;
export function chooseVersion(byteLength: number): number;
export function dataCapacity(version: number): number;
