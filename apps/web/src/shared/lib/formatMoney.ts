const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** Formats an integer amount of cents for display. Money is never formatted anywhere else. */
export function formatMoney(amountInCents: number, currency = 'COP'): string {
  const safeAmount = Number.isFinite(amountInCents) ? amountInCents : 0;
  return formatterFor(currency).format(Math.round(safeAmount) / 100);
}
