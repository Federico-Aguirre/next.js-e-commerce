import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function GoogleLoginAlert() {
  const params = useLocalSearchParams<{ login?: string }>();
  const router = useRouter();

  useEffect(() => {
    // Si la app se abre desde un Deep Link con ?login=success
    if (params.login === 'success') {
      Alert.alert(
        '¡Inicio de sesión exitoso!',
        'Has iniciado sesión con Google correctamente.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/'), // Limpia los parámetros navegando a la raíz
          },
        ],
      );
    }
  }, [params.login, router]);

  return null;
}
