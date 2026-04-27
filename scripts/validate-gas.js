const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "src");
const files = fs
  .readdirSync(root)
  .filter((file) => file.endsWith(".gs"))
  .sort();

if (files.length === 0) {
  console.error("No .gs files found in src/.");
  process.exit(1);
}

let ok = true;
const combined = [];

for (const file of files) {
  const fullPath = path.join(root, file);
  const source = fs.readFileSync(fullPath, "utf8");
  combined.push(`\n// ${file}\n${source}`);

  try {
    new vm.Script(source, { filename: file });
    console.log(`OK ${file}`);
  } catch (error) {
    ok = false;
    console.error(`ERROR ${file}`);
    console.error(error.message);
  }
}

if (ok) {
  try {
    new vm.Script(combined.join("\n"), { filename: "combined Apps Script source" });
    console.log("OK combined Apps Script source");
  } catch (error) {
    ok = false;
    console.error("ERROR combined Apps Script source");
    console.error(error.message);
  }
}

if (!ok) {
  process.exit(1);
}
