/// <reference types="cypress" />

/**
 * EMI Calculator — focused E2E suite for https://emicalculator.net/
 *
 * Test flow:
 *  1. Sliders  — drag handles to update loan inputs
 *  2. EMI      — UI values match the standard EMI formula
 *  3. Charts   — bar chart and payment table agree year-by-year
 *  4. Excel    — downloaded file contains correct summary and schedule
 */

import { expectedEmi, parseRupee, rowByLabel } from "../support/helpers/emiHelpers";

// Same loan used in every test so results are predictable and comparable.
const LOAN = {
  amount: 2000000,
  rate: 10.5,
  years: 15,
  months: 180,
};

const EXCEL_SCHEDULE_HEADERS = [
  "Month #",
  "Month & Year",
  "Principal (A)",
  "Interest (B)",
  "Total Monthly Payment (A + B)",
  "Outstanding Balance",
  "Loan Paid To Date (%)",
];

// --- Test helpers (keep logic here so each `it` reads like plain steps) ---

/** Set amount, rate and tenure through inputs, then wait for EMI to recalculate. */
const applyLoan = () => {
  cy.setSlider("amount", LOAN.amount);
  cy.setSlider("interest", LOAN.rate);
  cy.setSlider("tenure", LOAN.years);
  cy.waitForEmiCalculation();
};

/** Expected EMI values for the shared LOAN — used to cross-check UI and Excel. */
const calculatedEmi = () => expectedEmi(LOAN.amount, LOAN.rate, LOAN.months);

/** Every year in the table should match the same year in the bar chart. */
const expectTableMatchesChart = (tableRows, chartRows) => {
  expect(tableRows.length).to.eq(chartRows.length);
  expect(tableRows.length).to.be.greaterThan(0);

  tableRows.forEach((tableRow, index) => {
    const chartRow = chartRows[index];
    expect(tableRow.year, `year label row ${index}`).to.eq(chartRow.year);
    expect(tableRow.principal, `principal row ${index}`).to.eq(chartRow.principal);
    expect(tableRow.interest, `interest row ${index}`).to.eq(chartRow.interest);
  });
};

/** Top section of the Excel export — loan amount, rate and tenure. */
const expectExcelLoanDetails = (rows) => {
  expect(rows[0][0]).to.eq("Loan Details");
  expect(rows[1][0]).to.eq("Home Loan Amount");
  expect(rows[1][1]).to.eq(LOAN.amount);
  expect(rows[2][0]).to.eq("Interest Rate (%)");
  expect(rows[2][1]).to.be.closeTo(LOAN.rate, 0.01);
  expect(rows[3][0]).to.eq("Loan Tenure (months)");
  expect(rows[3][1]).to.eq(LOAN.months);
};

/** Payment summary rows in Excel should match the calculated EMI breakdown. */
const expectExcelPaymentSummary = (rows, expected) => {
  expect(rows[5][0]).to.eq("Payment Summary");
  expect(rowByLabel(rows, "Loan EMI")[1]).to.eq(expected.emi);
  expect(rowByLabel(rows, "Total Interest Payable")[1]).to.eq(expected.totalInterest);
  expect(rowByLabel(rows, "Total Payment (Principal + Interest)")[1]).to.eq(expected.totalPayment);
};

/** First month row in the schedule should have valid principal, interest and total. */
const expectExcelSchedule = (rows) => {
  const headerRow = rows.find((row) => row[0] === "Month #");
  expect(headerRow).to.deep.eq(EXCEL_SCHEDULE_HEADERS);

  const firstMonth = rows[rows.indexOf(headerRow) + 1];
  expect(firstMonth[0]).to.eq(1);
  expect(firstMonth[2]).to.be.greaterThan(0);
  expect(firstMonth[3]).to.be.greaterThan(0);
  expect(firstMonth[4]).to.eq(firstMonth[2] + firstMonth[3]);
};

describe("EMI Calculator", () => {
  before(() => {
    cy.visitEmiCalculator();
    cy.resetHomeLoan();
  });

  // --- 1. Slider interaction ---

  it("updates home loan amount, interest rate and tenure using sliders", () => {
    cy.slideSlider("amount", LOAN.amount);
    cy.get("#loanamount")
      .invoke("val")
      .then((val) => expect(parseRupee(val)).to.eq(LOAN.amount));

    cy.slideSlider("interest", LOAN.rate);
    cy.get("#loaninterest").should("have.value", String(LOAN.rate));

    cy.slideSlider("tenure", LOAN.years);
    cy.get("#loanterm").should("have.value", String(LOAN.years));
  });

  // --- 2. EMI formula validation ---

  it("captures EMI from UI and validates against formula", () => {
    applyLoan();

    const expected = calculatedEmi();

    cy.get("#emiamount span")
      .invoke("text")
      .then((text) => expect(parseRupee(text)).to.eq(expected.emi));

    cy.assertEmiSummary(expected);
  });

  // --- 3. Bar chart vs payment table ---

  it("matches bar chart and payment table values year-wise", () => {
    applyLoan();

    cy.getBarChartByYear().then((chartRows) => {
      cy.getPaymentTableByYear().then((tableRows) => {
        expectTableMatchesChart(tableRows, chartRows);
      });
    });
  });

  // --- 4. Excel download ---

  it("downloads excel file with correct loan summary and schedule", () => {
    applyLoan();

    const expected = calculatedEmi();

    cy.downloadExcel().then((rows) => {
      expectExcelLoanDetails(rows);
      expectExcelPaymentSummary(rows, expected);
      expectExcelSchedule(rows);
    });
  });
});
