import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.universite.app',
  appName: 'Universite',
  webDir: 'public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
