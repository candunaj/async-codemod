const jscodeshift = require("jscodeshift");
const transformer = require("./async-transform");
const fs = require("fs/promises");

async function main() {
  try {
    let content = await fs.readFile("test2.js", { encoding: "utf-8" });
    let source = transformer({ source: content }, { jscodeshift: jscodeshift });

    console.log(source);
  } catch (err) {
    console.log("error");
    console.error(err.stack);
  }
}

main();
