import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    // Con esto ocultamos la cabecera fea por defecto en TODAS las pantallas de (auth)
    <Stack screenOptions={{ headerShown: false }}>
      
      {/* Las declaramos aquí (opcional pero buena práctica) por si en el futuro 
          queremos darle una animación o un título específico a alguna */}
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="registro" />
      <Stack.Screen name="recuperar-password" />
      <Stack.Screen name="callback" />

    </Stack>
  );
}