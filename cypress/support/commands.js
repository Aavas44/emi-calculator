import { parseRupee } from "./helpers/emiHelpers";

const baseUrl = Cypress.env("BASE_URL");

// Opens the calculator and waits until the form and first EMI result are ready.
Cypress.Commands.add("visitEmiCalculator", () => {
  cy.visit(baseUrl);
  cy.get("#emicalculatorform", { timeout: 15000 }).should("be.visible");
  cy.waitForEmiCalculation();
});

// The site shows a "Calculating EMI..." overlay while recalculating — wait until it disappears.
Cypress.Commands.add("waitForEmiCalculation", () => {
  cy.get("body", { timeout: 15000 }).should(($body) => {
    expect($body.find(".loadmask-msg:visible")).to.have.length(0);
  });
});

// emicalculator.net uses jQuery UI sliders linked to text inputs (not native <input type="range">).
// Setting the input value and firing change syncs the slider handle and triggers recalculation.
Cypress.Commands.add("setSlider", (field, value) => {
  const map = { amount: "#loanamount", interest: "#loaninterest", tenure: "#loanterm" };
  cy.get(map[field]).invoke("val", value).trigger("change");
});

const SLIDER_MAP = {
  amount: "#loanamountslider",
  interest: "#loaninterestslider",
  tenure: "#loantermslider",
};

// Physically drags the slider handle with real mouse events (cypress-real-events).
// 1. Read min/max/step from the jQuery UI widget and compute the target value.
// 2. Drag handle to the target position on the track.
// 3. Fine-tune with arrow keys if headless CI lands a step off (common in GitHub Actions).
Cypress.Commands.add("slideSlider", (field, value, steps = 1) => {
  const sliderSelector = SLIDER_MAP[field];
  const handleSelector = `${sliderSelector} > .ui-slider-handle`;

  cy.window().then((win) => {
    const $slider = win.jQuery(sliderSelector);
    const min = $slider.slider("option", "min");
    const max = $slider.slider("option", "max");
    const step = $slider.slider("option", "step");
    const current = $slider.slider("value");

    let target;
    if (value === "increase") {
      target = Math.min(max, current + step * steps);
    } else if (value === "decrease") {
      target = Math.max(min, current - step * steps);
    } else {
      target = Math.min(max, Math.max(min, Number(value)));
    }

    const ratio = (target - min) / (max - min);

    cy.get(sliderSelector).then(($track) => {
      const rect = $track[0].getBoundingClientRect();
      const targetX = Math.round(ratio * rect.width);
      const targetY = Math.round(rect.height / 2);

      cy.get(handleSelector)
        .scrollIntoView()
        .should("be.visible")
        .realMouseDown({ button: "left", position: "center", scrollBehavior: "nearest" })
        .realMouseMove(5, 0, { position: "center", scrollBehavior: "nearest" });

      cy.get(sliderSelector)
        .realMouseMove(targetX, targetY, { position: "topLeft", scrollBehavior: "nearest" })
        .realMouseUp({ position: "topLeft", scrollBehavior: "nearest" });
    });

    cy.window().then((win) => {
      const $slider = win.jQuery(sliderSelector);
      const stepSize = $slider.slider("option", "step");
      const currentValue = $slider.slider("value");
      const stepsOff = Math.round((target - currentValue) / stepSize);

      const nudgeWithArrowKeys = (remaining) => {
        if (remaining === 0) return;

        const key = remaining > 0 ? "ArrowRight" : "ArrowLeft";
        cy.get(handleSelector).focus().realPress(key);
        nudgeWithArrowKeys(remaining > 0 ? remaining - 1 : remaining + 1);
      };

      nudgeWithArrowKeys(stepsOff);
    });
  });

  cy.waitForEmiCalculation();
});

Cypress.Commands.add("resetHomeLoan", () => {
  cy.get("#home-loan").click({ force: true });
  cy.get('label[for="loanamount"]').should("contain", "Home Loan Amount");
  cy.get("#yearformat").select("calendaryear", { force: true });
  cy.waitForEmiCalculation();
});

Cypress.Commands.add("assertEmiSummary", ({ emi, totalInterest, totalPayment }) => {
  cy.waitForEmiCalculation();

  cy.get("#emiamount span")
    .invoke("text")
    .then((text) => expect(parseRupee(text)).to.eq(emi));

  cy.get("#emitotalinterest span")
    .invoke("text")
    .then((text) => expect(parseRupee(text)).to.eq(totalInterest));

  cy.get("#emitotalamount span")
    .invoke("text")
    .then((text) => expect(parseRupee(text)).to.eq(totalPayment));
});

// Parses each row of the yearly payment schedule table into { year, principal, interest }.
Cypress.Commands.add("getPaymentTableByYear", () => {
  return cy.get("#emipaymenttable .yearlypaymentdetails").then(($rows) =>
    [...$rows].map((row) => {
      const $row = Cypress.$(row);
      return {
        year: $row.find(".paymentyear").text().trim(),
        principal: parseRupee($row.find(".currency").eq(0).text()),
        interest: parseRupee($row.find(".currency").eq(1).text()),
      };
    }),
  );
});

// Reads Highcharts bar chart (#emibarchart) data directly from the browser.
// Returns one object per year with Principal and Interest series values (rounded to match the UI).
Cypress.Commands.add("getBarChartByYear", () => {
  return cy.window().then((win) => {
    const chart = win.Highcharts.charts.find((c) => c?.renderTo?.id === "emibarchart");
    expect(chart, "bar chart").to.exist;

    const principal = chart.series.find((s) => s.name === "Principal");
    const interest = chart.series.find((s) => s.name === "Interest");

    return chart.xAxis[0].categories.map((year, index) => ({
      year: String(year),
      principal: Math.round(principal.data[index].y),
      interest: Math.round(interest.data[index].y),
    }));
  });
});

const EXCEL_FILE = "loan_amortization_schedule.xlsx";

// Triggers a real browser download, waits for the file in cypress/downloads,
// then parses it in Node (via cy.task) and returns rows as a 2D array for assertions.
Cypress.Commands.add("downloadExcel", () => {
  cy.task("deleteDownload", EXCEL_FILE, { log: false });
  cy.contains("a.ecaldownloadexcel", "Download Excel").click({ force: true });
  cy.readFile(`${Cypress.config("downloadsFolder")}/${EXCEL_FILE}`, { timeout: 15000 });
  return cy.task("readExcelRows", EXCEL_FILE);
});
