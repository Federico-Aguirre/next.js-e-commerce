import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      {/* Configura la barra de estado del celular (batería, hora, wifi) en color oscuro */}
      <StatusBar style="dark" />

      {/* Contenedor de navegación principal */}
      <Stack
        screenOptions={{
          headerShown: false, // Oculta la barra de navegación superior por defecto
          contentStyle: { backgroundColor: '#f9fafb' }, // Color de fondo global de la app
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}