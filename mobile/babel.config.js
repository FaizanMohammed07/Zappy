module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' enables className on RN components
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      // NativeWind v4 ships its Babel integration as a PRESET (not a plugin)
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated v4 / Expo SDK 56: the worklets plugin replaces
      // 'react-native-reanimated/plugin' and MUST be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
