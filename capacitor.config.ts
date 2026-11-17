import type { CapacitorConfig } from '@capacitor/cli';

// Vitfix Pro — appli artisan Android et iPhone. Elle affiche l'espace mobile du site (https://vitfix.io/pro/mobile/)
// au lieu d'embarquer un export statique (choix de Frédéric du 12/11/2026, « voie rapide ») : connexion, données et
// mises à jour sont celles du site, sans repasser par les stores. Capacitor présente `server.url` comme prévu pour le
// rechargement à chaud : limites (hors ligne, revue Apple) dans MOBILE_GUIDE.md. Invariants gardés par
// tests/mobile/capacitor-config.test.ts.
const config: CapacitorConfig = {
  appId: 'io.vitfix.pro',
  appName: 'Vitfix Pro',
  // Seulement la page locale « hors connexion » : le contenu vient du site.
  webDir: 'mobile/www',
  server: {
    // L'origine seule, sans chemin ni barre finale : Android en tire la règle d'origine du pont JS (un chemin la
    // rendrait invalide). Le chemin de départ va dans appStartPath ; sans langue, le middleware choisit /fr/ ou /pt/.
    url: 'https://vitfix.io',
    appStartPath: '/pro/mobile/',
    // Page locale affichée quand le site ne répond pas (réseau coupé ; sous Android, aussi toute erreur HTTP d'une
    // page entière, 404 comprise).
    errorPath: 'index.html',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFC107',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FFC107',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FFC107',
      sound: 'default',
    },
  },
  ios: {
    contentInset: 'always',
    // Exige la liste WKAppBoundDomains d'ios/App/App/Info.plist, qui doit contenir l'hôte de server.url.
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
