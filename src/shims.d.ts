/**
 * Ambient declarations for assets and third-party modules that ship no types.
 */

// CSS Modules (compiled to a hashed class map + auto-injected <style> by the
// tsdown build; see tsdown.config.ts).
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

// occt-import-js ships a JS-only WASM wrapper; we cast its namespace to the
// structural `OcctImportJs` interface in src/parse/step.ts.
declare module 'occt-import-js'
