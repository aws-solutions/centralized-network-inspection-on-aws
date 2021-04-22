module.exports = {
    "roots": [
      "<rootDir>/__tests__"
    ],
    testMatch: [ '**/*.spec.ts', '**/*.test.ts'],
    "transform": {
      "^.+\\.tsx?$": "ts-jest"
    },
    coverageReporters: [
      "text",
      ["lcov", {"projectRoot": "../../"}]
    ],
    testTimeout: 30000
  }
