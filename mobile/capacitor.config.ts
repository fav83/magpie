import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.magpie.app',
  appName: 'Magpie',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  // Uncomment for live reload during development:
  // server: {
  //   url: 'http://10.0.2.2:5173',
  //   cleartext: true,
  // },
};

export default config;
