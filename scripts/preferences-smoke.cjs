const assert = require("node:assert/strict");

class StorageMock {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const properties = new Map();
global.window = { localStorage: new StorageMock() };
global.document = {
  documentElement: {
    dataset: {},
    style: { setProperty: (key, value) => properties.set(key, value) },
  },
};

const preferencesModule = require("../.preferences-test/displayPreferences.js");
const {
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_PREFERENCES_KEY,
  readDisplayPreferences,
  saveDisplayPreferences,
} = preferencesModule;

assert.deepEqual(readDisplayPreferences(), DEFAULT_DISPLAY_PREFERENCES);

const customized = {
  columns: 6,
  textSize: "large",
  metadata: {
    creator: false,
    source: true,
    likes: false,
    year: true,
    duration: false,
  },
};
saveDisplayPreferences(customized);
assert.deepEqual(readDisplayPreferences(), customized);
assert.equal(document.documentElement.dataset.textSize, "large");
assert.equal(properties.get("--preferred-video-columns"), "6");

window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, "not-json");
assert.deepEqual(readDisplayPreferences(), DEFAULT_DISPLAY_PREFERENCES);

window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({
  columns: 99,
  textSize: "huge",
  metadata: { creator: "false", source: false },
}));
const repaired = readDisplayPreferences();
assert.equal(repaired.columns, 5);
assert.equal(repaired.textSize, "default");
assert.equal(repaired.metadata.creator, true);
assert.equal(repaired.metadata.source, false);

console.log("Display preferences smoke test passed.");
