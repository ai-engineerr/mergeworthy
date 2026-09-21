import { registerHooks } from "node:module";

/**
 * Lets `npm run check` import application modules that use the `@/` alias, so the
 * source is written the way Next expects rather than contorted for the checker.
 * Extensionless specifiers get `.ts` appended, which is what the alias always means here.
 */
const SOURCE_ROOT = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (!specifier.startsWith("@/")) return next(specifier, context);

    const path = specifier.slice(2);
    const withExtension = /\.[a-z]+$/.test(path) ? path : `${path}.ts`;

    return next(new URL(withExtension, SOURCE_ROOT).href, context);
  }
});
