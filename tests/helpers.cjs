const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Compile the real source in isolation; only the network client is replaced.
exports.load = (file, mocks = {}, env = {}) => {
  const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.env", JSON.stringify(env));
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (name in mocks) return mocks[name];
        throw new Error(`Unexpected dependency: ${name}`);
      },
      crypto: globalThis.crypto,
      FileReader: globalThis.FileReader,
    },
    { filename: file },
  );
  return module.exports;
};
