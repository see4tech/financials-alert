/** Use Babel for compilation so the build does not require platform-specific SWC binaries (e.g. on Netlify CI). */
module.exports = {
  presets: ['next/babel'],
};
