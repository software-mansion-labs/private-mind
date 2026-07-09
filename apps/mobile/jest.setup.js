// Prevent expo's winter runtime lazy getters from firing outside jest test scope.
// expo/src/winter/runtime.native.ts installs lazy getters on globalThis via installGlobal.
// These getters call require() lazily, which triggers jest-runtime's "outside scope" guard.
// Overwriting each property with a plain value short-circuits the getters.

const defineGlobal = (name, value) => {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
};

defineGlobal('__ExpoImportMetaRegistry', { url: null });

if (typeof globalThis.structuredClone === 'undefined') {
  defineGlobal('structuredClone', (obj) => JSON.parse(JSON.stringify(obj)));
}
