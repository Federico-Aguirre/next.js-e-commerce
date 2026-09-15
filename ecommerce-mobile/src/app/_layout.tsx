if (typeof requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (callback: (...args: any[]) => void) =>
    setTimeout(callback, 0);
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

import '../globals.css';
import React, { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_LOCAL_URL = 'http://192.168.3.9.nip.io:3001';

const getBaseUrl = (): string => {
  if (!__DEV__) return 'https://next-js-e-commerce-999.vercel.app';
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3001`;
  }
  return process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_LOCAL_URL;
};

export const API_BASE_URL = getBaseUrl();

export default function RootLayout() {
  const setSession = useAuthStore((state) => state.setSession);

  const processGoogleToken = (idToken: string, platform: 'web' | 'mobile') => {
    if (platform === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }

    fetch(`${API_BASE_URL}/api/auth/google-mobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error en autenticación');

        setSession({ user: data.user });

        if (platform === 'web') {
          window.alert(`¡Bienvenido! Hola ${data.user.name || data.user.email}`);
        } else {
          Alert.alert('¡Bienvenido!', `Hola ${data.user.name || data.user.email}`);
        }
        router.replace('/');
      })
      .catch((err) => console.error(`Error al verificar token (${platform}):`, err));
  };

  useEffect(() => {
    // Solo sincroniza si la llamada responde exitosamente con un usuario
    fetch(`${API_BASE_URL}/api/auth/session`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.user) {
          setSession(data);
        }
      })
      .catch(() => {
        // En móvil se ignora el fallo de cookies web
      }
    );
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('id_token=')) {
        const urlParams = new URLSearchParams(hash.replace('#', '?'));
        const idToken = urlParams.get('id_token');
        if (idToken) processGoogleToken(idToken, 'web');
      }
    } else {
      const handleDeepLink = (event: { url: string }) => {
        if (!event.url) return;

        const parsed = Linking.parse(event.url);
        let idToken = parsed.queryParams?.id_token as string;

        if (!idToken && event.url.includes('id_token=')) {
          idToken = event.url.split('id_token=')[1].split('&')[0];
        }

        if (idToken) processGoogleToken(idToken, 'mobile');
      };

      const subscription = Linking.addEventListener('url', handleDeepLink);

      Linking.getInitialURL().then((url) => {
        if (url) handleDeepLink({ url });
      });

      return () => subscription.remove();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}