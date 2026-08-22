import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, ScrollView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { useTheme } from '@/hooks/use-theme';

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
      contentContainerClassName="flex-row justify-center"
      contentContainerStyle={{
        paddingTop: Platform.OS === 'android' ? safeAreaInsets.top : 24,
        paddingBottom: safeAreaInsets.bottom + 20,
      }}>
      <View className="w-full max-w-xl flex-grow">
        {/* Encabezado */}
        <View className="items-center gap-3 px-4 py-6">
          <Text className="text-2xl font-bold dark:text-white">Explore</Text>
          <Text className="text-center text-gray-500 dark:text-gray-400">
            This starter app includes example{'\n'}code to help you get started.
          </Text>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <Pressable className="active:opacity-70">
              <View className="flex-row items-center justify-center gap-1 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
                <Text className="font-semibold text-blue-500">Expo documentation</Text>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'arrow.up.right.square', android: 'link', web: 'link' }}
                  size={12}
                />
              </View>
            </Pressable>
          </ExternalLink>
        </View>

        {/* Secciones colapsables */}
        <View className="gap-5 px-4 pt-3">
          <Collapsible title="File-based routing">
            <Text className="text-sm text-gray-700 dark:text-gray-300">
              This app has two screens: <Text className="font-mono text-xs">src/app/index.tsx</Text> and{' '}
              <Text className="font-mono text-xs">src/app/explore.tsx</Text>
            </Text>
          </Collapsible>

          <Collapsible title="Android, iOS, and web support">
            <View className="items-center rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
              <Text className="text-sm text-gray-700 dark:text-gray-300">
                You can open this project on Android, iOS, and the web.
              </Text>
              <Image
                source={require('@/assets/images/tutorial-web.png')}
                className="mt-2 aspect-[296/171] w-full rounded-md"
                contentFit="cover"
              />
            </View>
          </Collapsible>

          <Collapsible title="Images">
            <Image
              source={require('@/assets/images/react-logo.png')}
              className="h-25 w-25 self-center"
              contentFit="contain"
            />
          </Collapsible>
        </View>

        {Platform.OS === 'web' && <WebBadge />}
      </View>
    </ScrollView>
  );
}