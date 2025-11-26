const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');

const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@mbdayo/react-native-health-kits': path.resolve(__dirname, '..', 'src'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
