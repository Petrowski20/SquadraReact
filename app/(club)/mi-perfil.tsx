import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput } from 'react-native'
import ScreenContainer from '../../components/ScreenContainer'
import i18n from '../../lib/i18n'
import { useAuthStore } from '../../lib/store'
import { useTheme } from '../../lib/useTheme'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://squadraapi.onrender.com'

async function pickAndCompressImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    alert('Se necesitan permisos para acceder a la galería')
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  })

  if (result.canceled || !result.assets?.length) return null

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  )

  return manipulated.uri
}

async function uploadProfilePhoto(uri: string, token: string): Promise<string> {
  const formData = new FormData()

  if (Platform.OS === 'web') {
    const response = await fetch(uri)
    const blob = await response.blob()
    formData.append('file', blob, 'avatar.jpg')
  } else {
    formData.append('file', {
      uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    } as any)
  }

  const res = await fetch(`${API_URL}/api/profile/photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || 'Error subiendo foto')
  }

  const data = await res.json()
  return data.photoUrl as string
}

export default function MiPerfil() {
const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  const c = useTheme()
  const { t } = useTranslation()
  const profile = useAuthStore((s: any) => s.profile)
  const setProfile = useAuthStore((s: any) => s.setProfile)
  const token = useAuthStore((s: any) => s.token)
  const themeMode = useAuthStore((s: any) => s.themeMode)
  const language = useAuthStore((s: any) => s.language)
  const setThemeMode = useAuthStore((s: any) => s.setThemeMode)
  const setLanguage = useAuthStore((s: any) => s.setLanguage)
  const [uploading, setUploading] = useState(false)

  const handleChangePassword = async () => {
    setPwError('');
    if (!oldPw) { setPwError('Introduce tu contraseña actual'); return; }
    if (newPw.length < 6) { setPwError('Mínimo 6 caracteres'); return; }
    if (newPw === oldPw) { setPwError('La nueva contraseña no puede ser igual a la anterior'); return; }
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden'); return; }
    setPwLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/profile/password`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }),
        });
        if (!res.ok) throw new Error(await res.text());
        setPwModal(false);
        setOldPw('');
        setNewPw('');
        setConfirmPw('');
        alert('Contraseña actualizada correctamente');
      } catch (e: any) {
        setPwError(e.message || 'Error al cambiar la contraseña');
      } finally {
        setPwLoading(false);
      }
    };

  const handleLanguage = (lang: 'es' | 'en') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const handleChangePhoto = async () => {
    const uri = await pickAndCompressImage()
    if (!uri || !token) return

    try {
      setUploading(true)
      const newUrl = await uploadProfilePhoto(uri, token)
      setProfile({ ...profile, photoUrl: newUrl })
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Usuario"
  const initials = [profile?.firstName?.charAt(0), profile?.lastName?.charAt(0)]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U"

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar y nombre */}
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={uploading}
            activeOpacity={0.8}
            style={[styles.avatar, { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}35` }]}
          >
            {profile?.photoUrl ? (
              <Image
                source={{ uri: profile.photoUrl }}
                style={[styles.avatar, { borderRadius: 20 }]}
              />
            ) : (
              <Text style={[styles.avatarText, { color: c.boton }]}>{initials}</Text>
            )}

            {uploading && (
              <View style={[styles.overlay, { borderRadius: 20 }]}>
                <ActivityIndicator color={c.boton} />
              </View>
            )}

            <View style={[styles.editBadge, { backgroundColor: c.boton, borderColor: c.fondo }]}>
              <Text style={{ color: '#fff', fontSize: 12 }}>✎</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.nombre, { color: c.texto }]}>{fullName}</Text>
          <Text style={[styles.email, { color: c.subtexto }]}>{profile?.email}</Text>
        </View>

        {/* Datos del perfil */}
        <View style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={[styles.cardTitle, { color: c.subtexto }]}>{t('profile.data')}</Text>
          <Fila label={t('profile.phone')} value={profile?.phone || '—'} c={c} />
          <Fila
            label={t('profile.document')}
            value={profile?.docNumber ? `${profile.docType} · ${profile.docNumber}` : '—'}
            c={c}
          />
        </View>

        {/* Selector de idioma */}
        <View style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={[styles.cardTitle, { color: c.subtexto }]}>{t('profile.language')}</Text>
          <View style={styles.opciones}>
            {(['es', 'en'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.opcion, {
                  backgroundColor: language === lang ? c.boton : 'transparent',
                  borderColor: language === lang ? c.boton : c.bordeInput,
                }]}
                onPress={() => handleLanguage(lang)}
              >
                <Text style={[styles.opcionText, { color: language === lang ? '#fff' : c.texto }]}>
                  {lang === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Selector de tema */}
        <View style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={[styles.cardTitle, { color: c.subtexto }]}>{t('profile.theme')}</Text>
          <View style={styles.opciones}>
            {([
              { value: 'light', label: `☀️ ${t('profile.themeLight')}` },
              { value: 'auto', label: `⚙️ ${t('profile.themeAuto')}` },
              { value: 'dark', label: `🌙 ${t('profile.themeDark')}` },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.opcion, {
                  backgroundColor: themeMode === opt.value ? c.boton : 'transparent',
                  borderColor: themeMode === opt.value ? c.boton : c.bordeInput,
                }]}
                onPress={() => setThemeMode(opt.value)}
              >
                <Text style={[styles.opcionText, { color: themeMode === opt.value ? '#fff' : c.texto }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cambiar contraseña (BOTÓN ARREGLADO) */}
        <TouchableOpacity
          style={[styles.card, styles.accionBtn, { borderColor: c.bordeInput, backgroundColor: c.input }]}
          onPress={() => setPwModal(true)}
        >
          <Text style={{ fontSize: 20 }}>🔑</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accionTitle, { color: c.texto }]}>Cambiar contraseña</Text>
            <Text style={[styles.accionSub, { color: c.subtexto }]}>Introduce tu nueva contraseña</Text>
          </View>
          <Text style={{ color: c.subtexto, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
            {/* Manual de Usuario */}
          {/* Manual de Usuario */}
        <TouchableOpacity
          style={[styles.card, styles.accionBtn, { borderColor: c.bordeInput, backgroundColor: c.input }]}
          onPress={() => router.push('/manual' as any)} 
        >
          <Text style={{ fontSize: 20 }}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accionTitle, { color: c.texto }]}>Manual de Usuario</Text>
            <Text style={[styles.accionSub, { color: c.subtexto }]}>Aprende a usar la aplicación</Text>
          </View>
          <Text style={{ color: c.subtexto, fontSize: 20 }}>›</Text>
        </TouchableOpacity>
        {/* Cambiar de club */}
        <TouchableOpacity
          style={[styles.card, styles.accionBtn, { borderColor: `${c.boton}40`, backgroundColor: `${c.boton}08` }]}
          onPress={() => router.replace('/(selector)')}
        >
          <Text style={{ fontSize: 20 }}>🔄</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accionTitle, { color: c.boton }]}>Cambiar de club</Text>
            <Text style={[styles.accionSub, { color: c.subtexto }]}>Vuelve al selector sin cerrar sesión</Text>
          </View>
          <Text style={{ color: c.boton, fontSize: 20 }}>›</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* MODAL DE CAMBIO DE CONTRASEÑA PEGADO AQUÍ */}
      <Modal visible={pwModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.texto }}>Cambiar contraseña</Text>
            
            <TextInput
              style={{ backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, borderRadius: 12, padding: 14, color: c.texto }}
              placeholder="Contraseña actual"
              placeholderTextColor={c.subtexto}
              secureTextEntry
              value={oldPw}
              onChangeText={setOldPw}
            />

            <TextInput
              style={{ backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, borderRadius: 12, padding: 14, color: c.texto }}
              placeholder="Nueva contraseña (min. 6)"
              placeholderTextColor={c.subtexto}
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
            />
            
            <TextInput
              style={{ backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, borderRadius: 12, padding: 14, color: c.texto }}
              placeholder="Confirmar contraseña" 
              placeholderTextColor={c.subtexto}
              secureTextEntry 
              value={confirmPw} 
              onChangeText={setConfirmPw}
            />
            
            {pwError !== '' && <Text style={{ color: '#ef4444', fontSize: 13 }}>⚠️ {pwError}</Text>}
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.bordeInput, alignItems: 'center' }} 
                onPress={() => { setPwModal(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
              >
                <Text style={{ color: c.texto, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.boton, alignItems: 'center' }} 
                onPress={handleChangePassword} 
                disabled={pwLoading}
              >
                {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  )
}

function Fila({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={styles.fila}>
      <Text style={[styles.filaLabel, { color: c.subtexto }]}>{label}</Text>
      <Text style={[styles.filaValue, { color: c.texto }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  avatarWrapper: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: 'bold' },
  nombre: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filaLabel: { fontSize: 14 },
  filaValue: { fontSize: 14, fontWeight: '500' },
  opciones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  opcion: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  opcionText: { fontSize: 14, fontWeight: '500' },
  accionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accionTitle: { fontSize: 15, fontWeight: '700' },
  accionSub: { fontSize: 12, marginTop: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
})