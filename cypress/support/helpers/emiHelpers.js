// Strips ₹ symbol, commas and whitespace so "₹20,00,000" becomes 2000000.
export const parseRupee = (text) => Number(String(text).replace(/[₹,\s]/g, ""));

// Standard EMI formula: P × r × (1+r)^n / ((1+r)^n − 1)
// r = monthly rate, n = tenure in months.
// Site displays rounded EMI but uses the unrounded value for total interest/payment.
export const expectedEmi = (principal, rate, months, advance = false) => {
  const r = rate / 12 / 100;
  const raw = advance
    ? ((Math.pow(1 + r, months - 1) / (Math.pow(1 + r, months) - 1)) * r * principal)
    : ((Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)) * r * principal);

  return {
    emi: Math.round(raw),
    totalInterest: Math.round(raw * months - principal),
    totalPayment: Math.round(raw * months),
  };
};

// Finds a row in the Excel export by its label in column A (e.g. "Loan EMI").
export const rowByLabel = (rows, label) => rows.find((row) => row[0] === label);
