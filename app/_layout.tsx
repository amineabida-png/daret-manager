import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { db, surChangement } from '../db';
import { lireParametres } from '../db/requetes';
import { definirLangue, t } from '../i18n';
import { ThemeProvider, useTheme } from '../components/theme';
import { Chargement } from '../components/ui';
import { initialiserNotifications, replanifierRappels } from '../utils/notifications';

function Navigation() {
  const { c, rtl } = useTheme();
  useEffect(() => {
    // Navigateur : sens d'écriture et langue de la page (alignement à droite en darija)
    if (Platform.OS === 'web') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = rtl ? 'ar-MA' : 'fr';
    }
  }, [rtl]);
  useEffect(() => { SystemUI.setBackgroundColorAsync(c.fond).catch(() => {}); }, [c.fond]);
  return (
    <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
      <StatusBar style={c.sombre ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.fond },
          headerShadowVisible: false,
          headerTintColor: c.texte,
          headerTitleStyle: { color: c.texte, fontWeight: '700', fontSize: 18 },
          contentStyle: { backgroundColor: c.fond },
          headerBackTitle: t('Retour'),
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="daret/nouvelle" options={{ title: t('Nouvelle daret'), presentation: 'modal' }} />
        <Stack.Screen name="daret/[id]/index" options={{ title: t('Daret') }} />
        <Stack.Screen name="daret/[id]/modifier" options={{ title: t('Modifier la daret'), presentation: 'modal' }} />
        <Stack.Screen name="daret/[id]/ordre" options={{ title: t('Ordre des tours') }} />
        <Stack.Screen name="daret/[id]/echanger" options={{ title: t('Échanger deux tours'), presentation: 'modal' }} />
        <Stack.Screen name="daret/[id]/tour/[tourId]" options={{ title: t('Paiements du tour') }} />
        <Stack.Screen name="membre/nouveau" options={{ title: t('Ajouter des membres'), presentation: 'modal' }} />
        <Stack.Screen name="membre/[id]/index" options={{ title: t('Fiche membre') }} />
        <Stack.Screen name="membre/[id]/modifier" options={{ title: t('Modifier le membre'), presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let desabonner: (() => void) | undefined;
    (async () => {
      await db();
      definirLangue((await lireParametres().catch(() => null))?.langue ?? 'fr');
      setPret(true);
      await initialiserNotifications().catch(() => false);
      replanifierRappels().catch(() => {});
      // Après chaque modification, les rappels sont reprogrammés (regroupés sur 1,5 s)
      desabonner = surChangement(() => {
        clearTimeout(minuterie);
        minuterie = setTimeout(() => { replanifierRappels().catch(() => {}); }, 1500);
      });
    })();
    return () => { clearTimeout(minuterie); desabonner?.(); };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>{pret ? <Navigation /> : <Chargement />}</ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
