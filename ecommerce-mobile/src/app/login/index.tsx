import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from '@/store/useAuthStore';

const DEFAULT_LOCAL_URL = 'http://192.168.3.9.nip.io:3001';

const API_BASE_URL =
  Platform.OS === 'web'
    ? typeof window !== 'undefined'
      ? `http://${window.location.hostname}:3001`
      : DEFAULT_LOCAL_URL
    : process.env.EXPO_PUBLIC_API_URL || DEFAULT_LOCAL_URL;

function GoogleIcon({ width = 20, height = 20 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.36 7.23 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.8 0 12s.43 3.9 1.19 5.42l4.09-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.64 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  console.log('WebClientID en runtime:', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  // Inicialización nativa de Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  const verifyTokenWithBackend = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google-mobile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error verificando usuario');

      setSession({ user: data.user });

      if (Platform.OS === 'web') {
        window.alert(`¡Bienvenido! Hola ${data.user.name || data.user.email}`);
      } else {
        Alert.alert('¡Bienvenido!', `Hola ${data.user.name || data.user.email}`);
      }

      router.replace('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error con el inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      setErrorMsg('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    if (!isLogin) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado');

        Alert.alert('¡Éxito!', 'Cuenta creada correctamente. Procede a iniciar sesión.');
        setIsLogin(true);
      } catch (err: unknown) {
        if (err instanceof Error) setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login-mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Credenciales inválidas');
      } else {
        // Guarda el objeto user en Zustand para que el Navbar lo lea inmediatamente
        setSession({ user: data.user });

        if (Platform.OS === 'web') {
          window.alert('¡Bienvenido! Inicio de sesión exitoso');
        } else {
          Alert.alert('¡Bienvenido!', `Hola ${data.user.name || data.user.email}`);
        }

        router.replace('/');
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      // Extracción segura del token firmado
      const idToken = response.data?.idToken || (response as any).idToken;

      if (idToken) {
        await verifyTokenWithBackend(idToken);
      } else {
        throw new Error('No se pudo obtener el token de autenticación de Google');
      }
    } catch (err: any) {
      console.error('Error con Google Login:', err);
      if (err.code !== 'ASYNC_OP_IN_PROGRESS') {
        setErrorMsg(err.message || 'Ocurrió un error con el inicio de sesión');
      }
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-8">
      <View className="max-w-md mx-auto w-full pb-12 gap-y-6">
        <View className="items-center gap-y-2">
          <Text className="text-3xl font-black text-gray-900 text-center">
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </Text>
          <Pressable
            onPress={() => {
              setIsLogin(!isLogin);
              setErrorMsg(null);
            }}
          >
            <Text className="text-xs font-bold text-indigo-600 underline text-center">
              {isLogin ? '¿No tienes usuario? Regístrate' : '¿Ya eres miembro? Inicia sesión'}
            </Text>
          </Pressable>
        </View>

        <View className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-y-4">
          {errorMsg && (
            <View className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md">
              <Text className="text-xs text-red-700 font-semibold">⚠️ {errorMsg}</Text>
            </View>
          )}

          {!isLogin && (
            <View className="gap-y-1">
              <Text className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Nombre Completo
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                placeholderTextColor="#9ca3af"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800"
              />
            </View>
          )}

          <View className="gap-y-1">
            <Text className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Correo Electrónico
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="nova@store.com"
              placeholderTextColor="#9ca3af"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800"
            />
          </View>

          <View className="gap-y-1">
            <Text className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Contraseña
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800"
            />
          </View>

          <Pressable
            disabled={loading}
            onPress={handleSubmit}
            className={`w-full h-12 bg-gray-900 rounded-lg justify-center items-center active:bg-indigo-600 shadow-md ${
              loading ? 'opacity-50' : ''
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white text-sm font-bold">
                {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            )}
          </Pressable>

          <View className="relative my-2 items-center justify-center">
            <View className="w-full border-t border-gray-200 absolute" />
            <Text className="bg-white px-3 text-xs text-gray-400 font-medium">O continúa con</Text>
          </View>

          <Pressable
            disabled={loading}
            onPress={handleGoogleLogin}
            className={`w-full h-12 flex-row items-center justify-center gap-x-2 bg-white border border-gray-200 rounded-lg active:bg-gray-50 shadow-sm ${
              loading ? 'opacity-50' : ''
            }`}
          >
            <GoogleIcon width={20} height={20} />
            <Text className="text-sm font-bold text-gray-700">Entrar con Google</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}