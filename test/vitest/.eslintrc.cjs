module.exports = {
  env: {
    node: true,
    es2021: true,
    vitest: true,
  },
  globals: {
    process: 'readonly',
    global: 'readonly',
    globalThis: 'readonly',
    expect: 'readonly',
    require: 'readonly',
  },
};
