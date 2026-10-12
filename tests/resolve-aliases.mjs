// Lets Node's built-in TypeScript support resolve the imports Next.js resolves
// for the app: the `@/*` path alias from tsconfig.json and extensionless
// relative imports such as `./constants`.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function findSourceFile(basePath) {
  return EXTENSIONS.map((extension) => basePath + extension).find((file) => existsSync(file));
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const basePath = path.join(srcDir, specifier.slice(2));
      const file = existsSync(basePath) && path.extname(basePath) ? basePath : findSourceFile(basePath);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }

    if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
      const file = findSourceFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }

    return nextResolve(specifier, context);
  },
});
