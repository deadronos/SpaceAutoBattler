// CommonJS shim for tests that require('../../src/config/entitiesConfig')
// Updated to explicitly expose named functions on module.exports so CJS callers receive callable functions.
// Loads the TypeScript/ESM module and re-exports for CJS consumers.
try {
  // Prefer requiring the compiled JS if present
  const path = require("path");
  let mod;
  try {
    // Try compiled dist file first (common in builds)
    try {
      mod = require(
        path.join(__dirname, "..", "..", "dist", "config", "entitiesConfig"),
      );
    } catch (e) {
      // Otherwise try local module (Vitest should transform/handle TS imports)
      mod = require("./entitiesConfig");
    }
  } catch (e) {
    // If require failed (possibly because it's an ES module), rethrow to allow test harness to try alternate paths
    throw e;
  }
  // If the module uses ESM default export, merge it
  const exported =
    mod && mod.__esModule && mod.default
      ? Object.assign({}, mod.default, mod)
      : mod;
  // Ensure named exports exist on module.exports so CJS callers can destructure
  module.exports = exported;

  // Defensive mapping: common expected named functions/properties
  const ensureFn = (name) => {
    if (typeof module.exports[name] !== "function") {
      throw new TypeError(
        `entitiesConfig.cjs expected exported function '${name}', got: ${typeof module.exports[name]}`,
      );
    }
  };

  // Helper to copy from default or root into top-level module.exports
  const copyIfFn = (name) => {
    if (typeof module.exports[name] === "function") return;
    if (
      module.exports.default &&
      typeof module.exports.default[name] === "function"
    ) {
      module.exports[name] = module.exports.default[name];
      return;
    }
    // also check nested objects (some builds export a ShipConfig object with helpers)
    if (
      module.exports.ShipConfig &&
      typeof module.exports.ShipConfig[name] === "function"
    ) {
      module.exports[name] = module.exports.ShipConfig[name];
      return;
    }
  };

  // Common expected functions/props — extend as needed
  [
    "getShipConfig",
    "getEntityConfig",
    "getAllConfigs",
    "getSizeDefaults",
    "SIZE_DEFAULTS",
    "BULLET_DEFAULTS",
    "getDefaultShipType",
  ].forEach((n) => copyIfFn(n));

  // If getShipConfig is provided as a value (not function), but default contains the data object, provide a wrapper
  if (
    typeof module.exports.getShipConfig !== "function" &&
    module.exports.default
  ) {
    if (typeof module.exports.default === "function") {
      module.exports.getShipConfig = module.exports.default;
    } else if (typeof module.exports.default.getShipConfig === "function") {
      module.exports.getShipConfig = module.exports.default.getShipConfig;
    } else if (typeof module.exports.default === "object") {
      // default may be the config object itself; return it via a getter
      module.exports.getShipConfig = () => module.exports.default;
    }
  }

  // Ensure __esModule and export aliases for different import styles
  try {
    Object.defineProperty(module.exports, "__esModule", {
      value: true,
      enumerable: false,
    });
  } catch (e) {}
  try {
    // alias exports on both exports and module.exports
    if (typeof exports !== "undefined") {
      try {
        exports.getShipConfig = module.exports.getShipConfig;
        exports.getEntityConfig = module.exports.getEntityConfig;
        exports.getAllConfigs = module.exports.getAllConfigs;
      } catch (e) {}
    }
  } catch (e) {}

  // Validate presence
  try {
    ensureFn("getShipConfig");
  } catch (e) {
    // Throw a clearer error including available keys
    const keys = Object.keys(module.exports).join(", ");
    throw new Error(
      `entitiesConfig.cjs failed to resolve expected exports. Available keys: ${keys}. Original error: ${e.message}`,
    );
  }
} catch (err) {
  // If anything goes wrong, surface the error so tests fail clearly
  throw err;
}
