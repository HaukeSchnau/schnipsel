// @ts-check

// Expo's TypeScript setup otherwise installs `typescript` on every start; tsrs type-checks.
process.env.EXPO_NO_TYPESCRIPT_SETUP = "1";

/** @param {import("expo/config").ConfigContext} context */
module.exports = ({ config }) => config;
