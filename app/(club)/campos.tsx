import * as DocumentPicker from 'expo-document-picker'
import { useFocusEffect } from 'expo-router'
import Papa from 'papaparse'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { apiFetch } from '../../lib/api'
import { useAuthStore } from '../../lib/store'
import { useTheme } from '../../lib/useTheme'
import ScreenContainer from '../../components/ScreenContainer'

const DEFAULT_CAMPO_IMAGE =
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?q=80&w=500&auto=format&fit=crop'

// Gestor: puede ver inactivos y gestionar. Espectador: solo ve activos + cómo llegar.
const ROLES_GESTOR = ['PRESIDENT', 'COACH', 'STAFF']

export default function Campos() {
  const c = useTheme()

  const activeTeamId = useAuthStore((s: any) => s.activeTeamId)
  const activeRole   = useAuthStore((s: any) => s.activeRole)
  const clubId       = useAuthStore((s: any) => s.activeClubId)

  const isGestor    = ROLES_GESTOR.includes(activeRole ?? '')
  const isPresident = activeRole === 'PRESIDENT'
  const canCreate   = isGestor
  const canToggle   = isGestor
  const canDelete   = isPresident

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [campos, setCampos]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModal]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [brokenImgs, setBrokenImgs] = useState<Set<any>>(new Set())

  const [nombre, setNombre]       = useState('')
  const [direccion, setDireccion] = useState('')
  const [mapsUrl, setMapsUrl]     = useState('')
  const [photoUrl, setPhotoUrl]   = useState('')

  // ── CARGA ─────────────────────────────────────────────────────────────────
  const fetchCampos = useCallback(async () => {
    const id = clubId || activeTeamId
    if (!id) { setLoading(false); return }

    try {
      const url = clubId
        ? `/api/fields/club/${clubId}`
        : `/api/fields/club-by-team/${activeTeamId}`
      const res = await apiFetch(url)
      if (res.ok) setCampos(await res.json())
    } catch (e) {
      console.error('Error al cargar campos:', e)
    } finally {
      setLoading(false)
    }
  }, [clubId, activeTeamId])

  useEffect(() => { fetchCampos() }, [fetchCampos])

  useFocusEffect(useCallback(() => { fetchCampos() }, [fetchCampos]))

  // ── ACCIONES COMUNES ──────────────────────────────────────────────────────
  const abrirMaps = (campo: any) => {
    const url = campo.mapUrl
      ? campo.mapUrl
      : `https://maps.google.com/?q=${encodeURIComponent(campo.address)}`
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir el mapa.'))
  }

  // ── ACCIONES GESTOR ───────────────────────────────────────────────────────
  const toggleActivo = async (id: number) => {
    setCampos(prev => prev.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f))
    // Items importados localmente tienen ID negativo — no existen en backend
    if (id < 0) return
    try {
      const res = await apiFetch(`/api/fields/${id}/toggle?clubId=${clubId}`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado del campo.')
      fetchCampos()
    }
  }

  const eliminarCampo = async (id: number) => {
    const confirmar = () => new Promise<boolean>(resolve => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('¿Eliminar este campo permanentemente?'))
      } else {
        Alert.alert('Eliminar campo', '¿Eliminar este campo permanentemente?', [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
        ])
      }
    })

    if (!await confirmar()) return

    // Items importados localmente tienen ID negativo — eliminar solo del estado
    if (id < 0) {
      setCampos(prev => prev.filter(f => f.id !== id))
      return
    }

    try {
      const res = await apiFetch(`/api/fields/${id}?clubId=${clubId}`, { method: 'DELETE' })
      if (res.ok) {
        setCampos(prev => prev.filter(f => f.id !== id))
      } else {
        Alert.alert('Error', 'No se pudo eliminar el campo.')
      }
    } catch {
      Alert.alert('Error de red', 'Fallo de conexión.')
    }
  }

  const guardarCampo = async () => {
    if (!nombre || !direccion) {
      Alert.alert('Atención', 'Nombre y dirección son obligatorios.')
      return
    }
    setSaving(true)
    try {
      const url = clubId
        ? `/api/fields/club/${clubId}`
        : `/api/fields/team/${activeTeamId}`

      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify({ name: nombre, address: direccion, mapUrl: mapsUrl, photoUrl: photoUrl || null }),
      })
      if (res.ok) {
        const nuevoCampo = await res.json()
        setCampos(prev => [...prev, nuevoCampo])
        cerrarModal()
      } else {
        Alert.alert('Error', 'No se pudo guardar el campo.')
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el campo.')
    } finally {
      setSaving(false)
    }
  }

  const handleImportCampos = async () => {
    try {
      setIsImporting(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'android' ? '*/*' : ['text/csv', 'text/plain', 'application/json'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.length) return

      const asset = result.assets[0]
      let text: string
      if (Platform.OS === 'web') {
        text = await fetch(asset.uri).then((r) => r.text())
      } else {
        const FS = (await import('expo-file-system')) as any
        text = await FS.readAsStringAsync(asset.uri)
      }

      const isJson = asset.name?.toLowerCase().endsWith('.json')
      let rows: any[]
      if (isJson) {
        const parsed = JSON.parse(text)
        rows = Array.isArray(parsed) ? parsed : [parsed]
      } else {
        const { data } = Papa.parse<any>(text, { header: true, skipEmptyLines: true, dynamicTyping: true })
        rows = data
      }

      if (!rows.length) {
        Alert.alert('Sin datos', 'No se encontraron registros en el archivo.')
        return
      }

      const validRows = rows.filter((row) => row.name || row.Nombre)
      if (!validRows.length) {
        Alert.alert('Error de formato', 'No se encontró la columna "name" o "Nombre" en el archivo.')
        return
      }

      // club_id SIEMPRE del contexto — ignoramos cualquier clubId del archivo
      const apiUrl = clubId
        ? `/api/fields/club/${clubId}`
        : `/api/fields/team/${activeTeamId}`

      let camposAñadidos = 0
      let camposOmitidos = 0
      const savedCampos: any[] = []

      for (const row of validRows) {
        try {
          const res = await apiFetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify({
              name: row.name || row.Nombre || '',
              address: row.address || row.Dirección || row.Direccion || '',
              mapUrl: row.mapUrl || row['Maps URL'] || row['URL Maps'] || null,
              photoUrl: row.photoUrl || row['Photo URL'] || null,
            }),
          })
          if (res.ok) {
            savedCampos.push(await res.json())
            camposAñadidos++
          } else {
            camposOmitidos++
          }
        } catch {
          camposOmitidos++
        }
      }

      if (camposAñadidos > 0) {
        setCampos((prev) => [...prev, ...savedCampos])
        const msg = camposOmitidos > 0
          ? `Se han importado ${camposAñadidos} campos nuevos. Se han omitido ${camposOmitidos} por estar duplicados.`
          : `Se han importado ${camposAñadidos} campos nuevos correctamente.`
        Alert.alert('Importación Completada', msg)
      } else {
        Alert.alert('Error', 'No se pudo guardar ningún campo. Verifica el formato del archivo.')
      }
    } catch {
      Alert.alert('Error de formato', 'El archivo tiene un formato inválido o no se pudo leer.')
    } finally {
      setIsImporting(false)
    }
  }

  const cerrarModal = () => {
    setModal(false)
    setNombre('')
    setDireccion('')
    setMapsUrl('')
    setPhotoUrl('')
  }

  const activos   = campos.filter(f => f.isActive)
  const inactivos = campos.filter(f => !f.isActive)

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenContainer>
        <View style={[styles.center, { backgroundColor: c.fondo }]}>
          <ActivityIndicator size="large" color={c.boton} />
        </View>
      </ScreenContainer>
    )
  }

  // ── VISTA ESPECTADOR ──────────────────────────────────────────────────────
  if (!isGestor) {
    return (
      <ScreenContainer>
        <ScrollView style={{ flex: 1, backgroundColor: c.fondo }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <Text style={[styles.titulo, { color: c.texto, marginBottom: 25 }]}>📍 Campos</Text>

          {activos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
              <Text style={{ fontSize: 30, marginBottom: 8 }}>🏟</Text>
              <Text style={[styles.emptyText, { color: c.subtexto, textAlign: 'center' }]}>
                El club aún no ha registrado campos de entrenamiento
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {activos.map(campo => (
                <View
                  key={campo.id}
                  style={[styles.campoCard, { backgroundColor: c.input, borderColor: c.bordeInput, borderLeftColor: c.boton }]}
                >
                  <Image
                    source={{ uri: brokenImgs.has(campo.id) || !campo.photo_url ? DEFAULT_CAMPO_IMAGE : campo.photo_url }}
                    style={styles.campoPhoto}
                    resizeMode="cover"
                    onError={() => setBrokenImgs(prev => new Set([...prev, campo.id]))}
                  />
                  <View style={styles.campoContent}>
                    <View style={styles.campoTexts}>
                      <Text style={[styles.campoNombre, { color: c.texto }]}>{campo.name}</Text>
                      <Text style={[styles.campoDireccion, { color: c.subtexto }]}>{campo.address}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btnComoLlegar, { backgroundColor: c.boton }]}
                      onPress={() => abrirMaps(campo)}
                    >
                      <Text style={styles.btnComoLlegarText}>📍 Cómo llegar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </ScreenContainer>
    )
  }

  // ── VISTA GESTOR ──────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
    <View style={[styles.wrapper, { backgroundColor: c.fondo }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.titulo, { color: c.texto }]}>📍 Campos</Text>
          {canCreate && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}
                onPress={handleImportCampos}
                disabled={isImporting}
              >
                {isImporting
                  ? <ActivityIndicator size="small" color={c.boton} />
                  : <Text style={{ color: c.boton, fontWeight: 'bold', fontSize: 13 }}>📥 Importar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: c.boton }]}
                onPress={() => setModal(true)}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>+ Añadir campo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {campos.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
            <Text style={[styles.emptyText, { color: c.subtexto }]}>🏟 No hay campos registrados</Text>
          </View>
        )}

        {/* ACTIVOS */}
        {activos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.subtexto }]}>Activos</Text>
            <View style={styles.list}>
              {activos.map(campo => (
                <View
                  key={campo.id}
                  style={[styles.campoCard, { backgroundColor: c.input, borderColor: c.bordeInput, borderLeftColor: c.boton }]}
                >
                  <Image
                    source={{ uri: brokenImgs.has(campo.id) || !campo.photo_url ? DEFAULT_CAMPO_IMAGE : campo.photo_url }}
                    style={styles.campoPhoto}
                    resizeMode="cover"
                    onError={() => setBrokenImgs(prev => new Set([...prev, campo.id]))}
                  />
                  <View style={styles.campoContent}>
                    <View style={styles.campoTexts}>
                      <Text style={[styles.campoNombre, { color: c.texto }]}>{campo.name}</Text>
                      <Text style={[styles.campoDireccion, { color: c.subtexto }]}>{campo.address}</Text>
                    </View>
                    <View style={styles.campoActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#3b82f615', borderColor: '#3b82f630' }]}
                        onPress={() => abrirMaps(campo)}
                      >
                        <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>🗺 Maps</Text>
                      </TouchableOpacity>
                      {canToggle && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b30' }]}
                          onPress={() => toggleActivo(campo.id)}
                        >
                          <Text style={[styles.actionButtonText, { color: '#f59e0b' }]}>Desactivar</Text>
                        </TouchableOpacity>
                      )}
                      {canDelete && (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}
                          onPress={() => eliminarCampo(campo.id)}
                        >
                          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>🗑 Eliminar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* INACTIVOS */}
        {canToggle && inactivos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.subtexto }]}>Inactivos</Text>
            <View style={styles.list}>
              {inactivos.map((campo, index) => (
                <View
                  key={campo.id || `inactivo-${index}`}
                  style={[styles.campoCard, { backgroundColor: c.input, borderColor: c.bordeInput, opacity: 0.6, paddingVertical: 14, gap: 0, borderLeftWidth: 1 }]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.campoNombre, { color: c.subtexto, fontSize: 15, marginBottom: 0 }]}>{campo.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => toggleActivo(campo.id)}
                        style={[styles.miniButton, { backgroundColor: `${c.boton}15` }]}
                      >
                        <Text style={{ color: c.boton, fontSize: 12, fontWeight: 'bold' }}>Activar</Text>
                      </TouchableOpacity>
                      {canDelete && (
                        /* Rojo destructivo — sin equivalente semántico en el tema */
                        <TouchableOpacity
                          onPress={() => eliminarCampo(campo.id)}
                          style={[styles.miniButton, { backgroundColor: '#ef444415' }]}
                        >
                          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* MODAL AÑADIR CAMPO */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={cerrarModal}>
        <Pressable style={styles.overlay} onPress={cerrarModal}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.fondo, borderColor: c.bordeInput }]} onPress={() => {}}>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitulo, { color: c.texto }]}>📍 Añadir campo</Text>
              <TouchableOpacity onPress={cerrarModal} disabled={saving}>
                <Text style={{ color: c.subtexto, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={[styles.label, { color: c.subtexto }]}>Nombre *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Campo Municipal..."
                  placeholderTextColor={c.subtexto}
                  editable={!saving}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: c.subtexto }]}>Dirección *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                  value={direccion}
                  onChangeText={setDireccion}
                  placeholder="Calle..."
                  placeholderTextColor={c.subtexto}
                  editable={!saving}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: c.subtexto }]}>Enlace Google Maps <Text style={{ fontStyle: 'italic' }}>(opcional)</Text></Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                  value={mapsUrl}
                  onChangeText={setMapsUrl}
                  placeholder="https://goo.gl/maps/..."
                  placeholderTextColor={c.subtexto}
                  autoCapitalize="none"
                  editable={!saving}
                />
              </View>
              <View>
                <Text style={[styles.label, { color: c.subtexto }]}>Foto del campo <Text style={{ fontStyle: 'italic' }}>(URL, opcional)</Text></Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                  value={photoUrl}
                  onChangeText={setPhotoUrl}
                  placeholder="https://..."
                  placeholderTextColor={c.subtexto}
                  autoCapitalize="none"
                  editable={!saving}
                />
                {!!photoUrl && (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                )}
              </View>
              <TouchableOpacity
                style={[styles.btnGuardar, { backgroundColor: saving ? c.bordeInput : c.boton }]}
                onPress={guardarCampo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnGuardarText}>Guardar campo</Text>
                )}
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  addButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  emptyCard: { padding: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', borderStyle: 'dashed' },
  emptyText: { fontSize: 15, fontWeight: '500' },
  section: { marginBottom: 30 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  list: { gap: 12 },
  campoCard: { borderRadius: 18, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden' },
  campoPhoto: { width: '100%', height: 140 },
  campoContent: { padding: 14, gap: 12 },
  campoTexts: { flex: 1 },
  campoNombre: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  campoDireccion: { fontSize: 13, lineHeight: 18 },
  photoPreview: { width: '100%', height: 100, borderRadius: 12, marginTop: 8 },
  campoActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionButtonText: { fontSize: 12, fontWeight: '700' },
  miniButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  btnComoLlegar: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnComoLlegarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, borderWidth: 1, borderBottomWidth: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  btnGuardar: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  btnGuardarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
