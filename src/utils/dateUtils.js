// @ts-check

/**
 * @file Utilitaires de manipulation de dates
 */

/**
 * Formate une date en chaîne YYYY-MM-DD
 * @param {Date} date - La date à formater
 * @returns {string} Date au format YYYY-MM-DD
 * @example
 * formatDateToYMD(new Date(2025, 0, 15)) // "2025-01-15"
 */
export const formatDateToYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse une chaîne YYYY-MM-DD en objet Date
 * @param {string} dateStr - La chaîne de date au format YYYY-MM-DD
 * @returns {Date} L'objet Date correspondant
 * @example
 * parseDateString("2025-01-15") // Date(2025, 0, 15)
 */
export const parseDateString = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
