// ============ SCORE UTILITIES ============

/**
 * Retourne la couleur et les degrés pour un score donné
 * @param {number} score - Score de 0 à 100
 * @returns {{ color: string, degrees: number }}
 */
export function getScoreColor(score) {
  const degrees = Math.max(0, Math.min(100, score)) * 3.6; // 0-100 => 0-360 degrees
  let color;

  if (score < 50) {
    color = "#d34848ff"; // Rouge
  } else if (score < 60) {
    color = "#fd6d1fff"; // Orange
  } else if (score < 70) {
    color = "#edb200ff"; // Jaune
  } else if (score <= 85) {
    color = "#4CAF50"; // Vert
  } else if (score <= 99) {
    color = "#038808ff"; // Vert foncé
  } else {
    color = "#2196F3"; // Bleu
  }

  return { color, degrees };
}
