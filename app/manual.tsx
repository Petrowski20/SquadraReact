// app/manual.tsx
import React, { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, Image,
  Text, TouchableOpacity, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Stack } from 'expo-router';
import Markdown from 'react-native-markdown-display';

import { manualSections, ManualBlock } from '../lib/docs/manualSelections';
import { useTheme } from '../lib/useTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const IMGS: Record<string, any> = {
  inicio_home:    require('../assets/manual/inicio_home.png'),
  login:          require('../assets/manual/login.png'),
  registro:       require('../assets/manual/registro.png'),
  recuperar_pass: require('../assets/manual/recuperar_pass.png'),
  lobby:          require('../assets/manual/lobby.png'),
  crear_club:     require('../assets/manual/crear_club.png'),
  unirse_club:    require('../assets/manual/unirse_club.png'),
  mi_perfil:      require('../assets/manual/mi_perfil.png'),
  cambiar_pass:   require('../assets/manual/cambiar_pass.png'),

  dashboard:           require('../assets/manual/dashboard.png'),
  nuevo_evento:        require('../assets/manual/nuevo_evento.png'),
  editar_evento:       require('../assets/manual/editar_evento.png'),
  editar_stats:        require('../assets/manual/editar_stats.png'),
  horarios_pres:       require('../assets/manual/horarios_pres.png'),
  tablon_pres:         require('../assets/manual/tablon_pres.png'),
  nuevo_anuncio:       require('../assets/manual/nuevo_anuncio.png'),
  mi_club_pres:        require('../assets/manual/mi_club_pres.png'),
  campos_pres:         require('../assets/manual/campos_pres.png'),
  asistencia_pres:     require('../assets/manual/asistencia_pres.png'),
  convocatorias_pres:  require('../assets/manual/convocatorias_pres.png'),
  stats_pres:          require('../assets/manual/stats_pres.png'),
  multas_pres:         require('../assets/manual/multas_pres.png'),
  peticiones:          require('../assets/manual/peticiones.png'),
  revisar_solicitud:   require('../assets/manual/revisar_solicitud.png'),
  cuotas:              require('../assets/manual/cuotas.png'),
  equipos_admin:       require('../assets/manual/equipos_admin.png'),

  entrenador_calendario:    require('../assets/manual/entrenador_calendario.png'),
  entrenador_horarios:      require('../assets/manual/entrenador_horarios.png'),
  entrenador_mi_club:       require('../assets/manual/entrenador_mi_club.png'),
  entrenador_campos:        require('../assets/manual/entrenador_campos.png'),
  entrenador_asistencia:    require('../assets/manual/entrenador_asistencia.png'),
  entrenador_convocatorias: require('../assets/manual/entrenador_convocatorias.png'),
  entrenador_stats:         require('../assets/manual/entrenador_stats.png'),
  entrenador_multas:        require('../assets/manual/entrenador_multas.png'),
};

function ManualImage({ imageKey, caption, theme }: { imageKey: string; caption?: string; theme: any }) {
  const [expanded, setExpanded] = useState(false);
  const src = IMGS[imageKey];
  if (!src) return null;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => !p);
  }, []);

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.93}
      style={[styles.imgWrap, { borderColor: '#3a3a3a' }]}
    >
      <Image
        source={src}
        style={[styles.img, expanded ? styles.imgOpen : styles.imgClosed]}
        resizeMode={expanded ? 'contain' : 'cover'}
      />
      <View style={[styles.badge, { backgroundColor: theme.boton }]}>
        <Text style={styles.badgeText}>{expanded ? '−' : '+'}</Text>
      </View>
      {caption ? (
        <Text style={[styles.caption, { color: '#888' }]}>
          {caption}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function PantallaManual() {
  const c = useTheme();

  const md = StyleSheet.create({
    body:      { color: c.texto, fontSize: 15, lineHeight: 24 },
    heading1:  { color: c.texto, fontSize: 26, fontWeight: 'bold', marginTop: 24, marginBottom: 12 },
    heading2:  { color: c.boton, fontSize: 20, fontWeight: 'bold', marginTop: 28, marginBottom: 10,
                 paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: c.boton },
    heading3:  { color: c.texto, fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 6 },
    strong:    { color: c.boton, fontWeight: 'bold' },
    em:        { color: '#999', fontStyle: 'italic' },
    list_item: { marginTop: 4, marginBottom: 4, color: c.texto },
    blockquote:{ backgroundColor: c.boton + '18', borderLeftWidth: 4, borderLeftColor: c.boton,
                 paddingHorizontal: 14, paddingVertical: 8, marginVertical: 8, borderRadius: 4 },
    hr:        { backgroundColor: '#333', height: 1, marginVertical: 20 },
    paragraph: { marginBottom: 10 },
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      <Stack.Screen
        options={{
          title: 'Manual de Usuario',
          headerShown: true,
          headerStyle: { backgroundColor: c.fondo },
          headerTintColor: c.texto,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {manualSections.map((block: ManualBlock, i: number) =>
          block.type === 'markdown' ? (
            <Markdown key={i} style={md}>{block.content}</Markdown>
          ) : (
            <ManualImage key={i} imageKey={block.key} caption={block.caption} theme={c} />
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 40,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  imgWrap: {
    marginVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  img:       { width: '100%' },
  imgClosed: { height: 200 },
  imgOpen:   { height: 500 },
  badge: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', opacity: 0.88,
  },
  badgeText: { color: '#fff', fontSize: 16, fontWeight: 'bold', lineHeight: 18 },
  caption:   { fontSize: 12, textAlign: 'center', paddingHorizontal: 10, paddingVertical: 6, fontStyle: 'italic' },
});