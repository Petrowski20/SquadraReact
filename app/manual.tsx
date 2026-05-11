// Ruta: app/manual.tsx
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import Markdown from 'react-native-markdown-display';

// Importamos tus datos y tu hook de temas
import { manualCompleto } from '../lib/docs/manualData';
import { useTheme } from '../lib/useTheme';

export default function PantallaManual() {
  // Llamamos a tu hook para obtener la paleta de colores actual
  const c = useTheme();

  // Metemos los estilos DENTRO de la función para que puedan leer las variables de 'c'
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.fondo, // Ahora el fondo es dinámico (blanco/oscuro)
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 20,
      maxWidth: 800, 
      marginHorizontal: 'auto',
    }
  });

  const markdownStyles = StyleSheet.create({
    body: { color: c.texto, fontSize: 16, lineHeight: 24 }, // El texto cambia con el tema
    heading1: { color: c.texto, fontSize: 28, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    heading2: { color: c.boton, fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10 }, // El verde se mantiene para resaltar
    heading3: { color: c.texto, fontSize: 18, fontWeight: '600', marginTop: 15, marginBottom: 5 },
    strong: { color: c.boton, fontWeight: 'bold' }, // Negritas en tu color principal (verde)
    list_item: { marginTop: 5, marginBottom: 5, color: c.texto }
  });

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Manual de Usuario',
          headerShown: true, 
          headerStyle: { backgroundColor: c.fondo }, // Cabecera dinámica
          headerTintColor: c.texto, // La flecha de volver se adapta al tema
        }} 
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Markdown style={markdownStyles}>
          {manualCompleto}
        </Markdown>
      </ScrollView>
    </View>
  );
}