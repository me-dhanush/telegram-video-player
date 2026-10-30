const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.join(__dirname, "..", "node_modules", "@videojs", "core", "dist");
const updates = [
  ["tap.js", /DOUBLETAP_WINDOW = (?:200|400)/, "DOUBLETAP_WINDOW = 400"],
  ["coordinator.js", /TAP_THRESHOLD = (?:250|400)/, "TAP_THRESHOLD = 400"],
];

for (const build of ["default", "dev"]) {
  for (const [fileName, pattern, replacement] of updates) {
    const filePath = path.join(packageRoot, build, "dom", "gesture", fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video.js gesture source was not found: ${filePath}`);
    }

    const source = fs.readFileSync(filePath, "utf8");
    if (!pattern.test(source)) {
      throw new Error(`Video.js gesture threshold was not found in ${filePath}`);
    }

    fs.writeFileSync(filePath, source.replace(pattern, replacement));
  }
}
