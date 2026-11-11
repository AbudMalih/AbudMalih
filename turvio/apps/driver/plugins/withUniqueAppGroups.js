// expo-share-intent prepends the App Group to the app's entitlements without checking whether it is
// already there, so running `expo prebuild` again on an existing ios/ folder lists it twice. Keep
// each App Group once (order kept). Cloud builds start without ios/ and are unaffected.
const { withEntitlementsPlist } = require("expo/config-plugins");

const KEY = "com.apple.security.application-groups";

module.exports = function withUniqueAppGroups(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const groups = cfg.modResults[KEY];
    if (Array.isArray(groups)) cfg.modResults[KEY] = [...new Set(groups)];
    return cfg;
  });
};
