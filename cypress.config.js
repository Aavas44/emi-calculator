const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { defineConfig } = require("cypress");
require("dotenv").config();


module.exports = defineConfig({
  env: { ...process.env },
  e2e: {
    baseUrl: "https://emicalculator.net",
    testIsolation: false,
    downloadsFolder: "cypress/downloads",
    viewportWidth: 1280,
    viewportHeight: 720,

    setupNodeEvents(on, config) {
      const downloadsFolder = config.downloadsFolder;

      // Node-side tasks for Excel download tests (browser saves file, Node reads it).
      on("task", {
        deleteDownload(fileName) {
          const filePath = path.join(downloadsFolder, fileName);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return null;
        },
        readExcelRows(fileName) {
          const filePath = path.join(downloadsFolder, fileName);
          const workbook = XLSX.readFile(filePath);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          return XLSX.utils.sheet_to_json(sheet, { header: 1 });
        },
      });

      return config;
    },
  },
});
