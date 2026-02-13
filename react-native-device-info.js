/**
 * Shim for react-native-device-info used by sp-react-native-in-app-updates.
 * Uses expo-constants to get app version and bundle ID.
 */
import Constants from 'expo-constants';

export const getBundleId = () => {
  return (
    Constants.expoConfig?.android?.package ??
    Constants.expoConfig?.ios?.bundleIdentifier ??
    ''
  );
};

export const getVersion = () => {
  return Constants.expoConfig?.version ?? '1.0.0';
};

export default {
  getBundleId,
  getVersion,
};
