import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/theme';
import type { NomIcone } from '../../components/ui';
import { t } from '../../i18n';

const icone = (plein: NomIcone, contour: NomIcone) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? plein : contour} color={color} size={24} />;

export default function OngletsLayout() {
  const { c, rtl } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primaire,
        tabBarInactiveTintColor: c.texteDoux,
        tabBarStyle: Platform.OS === 'web'
          ? { backgroundColor: c.surface, borderTopColor: c.bordure, height: 64 + insets.bottom, paddingTop: 4, paddingBottom: 8 + insets.bottom }
          : { backgroundColor: c.surface, borderTopColor: c.bordure, height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom, elevation: 12 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
        headerStyle: { backgroundColor: c.fond },
        headerShadowVisible: false,
        headerTitleAlign: rtl ? 'center' : 'left',
        headerTitleStyle: { color: c.texte, fontWeight: '700', fontSize: 22 },
        sceneStyle: { backgroundColor: c.fond },
      }}>
      <Tabs.Screen name="index" options={{ title: t('Accueil'), headerTitle: 'Daret Manager', tabBarIcon: icone('home', 'home-outline') }} />
      <Tabs.Screen name="darets" options={{ title: t('Mes darets'), tabBarIcon: icone('albums', 'albums-outline') }} />
      <Tabs.Screen name="parametres" options={{ title: t('Paramètres'), tabBarIcon: icone('settings', 'settings-outline') }} />
    </Tabs>
  );
}
