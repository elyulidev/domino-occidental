/**
 * Profile view helpers — pure functions for the dynamic profile page.
 */

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Format an ISO date string or Date object to "Mes YYYY" in Spanish.
 * Example: "2025-01-15T10:30:00Z" → "Enero 2025"
 */
export function formatMemberSince(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const month = MONTHS_ES[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}
