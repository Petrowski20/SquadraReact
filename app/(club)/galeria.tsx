import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import ScreenContainer from '../../components/ScreenContainer'
import { apiFetch } from '../../lib/api'
import { useAuthStore } from '../../lib/store'
import { useTheme } from '../../lib/useTheme'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://squadraapi.onrender.com'
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - 6) / 3)

interface GalleryImage {
  id: number
  imageUrl: string
  teamId: number
  clubId: number
  createdAt: string
  title?: string
  description?: string
}

interface TeamSummary {
  id: number
  category: string
  gender: string
  suffix: string | null
}

function teamLabel(t: TeamSummary) {
  const suffix = t.suffix ? ` ${t.suffix}` : ''
  return `${t.category} ${t.gender}${suffix}`
}

export default function Galeria() {
  const c = useTheme()
  const activeClubId = useAuthStore((s: any) => s.activeClubId)
  const activeTeamId = useAuthStore((s: any) => s.activeTeamId)
  const activeRole = useAuthStore((s: any) => s.activeRole)
  const token = useAuthStore((s: any) => s.token)

  const isPresident = activeRole === 'PRESIDENT'

  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [fullscreenImage, setFullscreenImage] = useState<GalleryImage | null>(null)

  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [pendingUri, setPendingUri] = useState<string | null>(null)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const resetUploadState = () => {
    setPendingUri(null)
    setTitle('')
    setDescription('')
  }

  const fetchImages = useCallback(async () => {
    if (!activeClubId) return
    try {
      const teamParam = isPresident ? '' : `&teamId=${activeTeamId}`
      const res = await apiFetch(`/api/gallery?clubId=${activeClubId}${teamParam}`)
      if (res.ok) setImages(await res.json())
    } catch (e) {
      console.error('Error fetching gallery', e)
    }
  }, [activeClubId, activeTeamId, isPresident])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchImages().finally(() => setLoading(false))
    }, [fetchImages])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchImages()
    setRefreshing(false)
  }

  const fetchTeams = async () => {
    if (!activeClubId) return
    try {
      const res = await apiFetch(`/api/club/equipos/${activeClubId}`)
      if (res.ok) {
        const data = await res.json()
        setTeams(data.filter((t: any) => t.isActive))
      }
    } catch (e) {
      console.error('Error fetching teams', e)
    }
  }

  const handleFAB = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      if (Platform.OS === 'web') window.alert('Se necesitan permisos para acceder a la galería')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    })

    if (result.canceled || !result.assets?.length) return

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )

    setPendingUri(manipulated.uri)
    await fetchTeams()
    setShowTeamPicker(true)
  }

  const handleUpload = async (teamId: number) => {
    if (!pendingUri || !activeClubId || !token) return
    setShowTeamPicker(false)
    setUploading(true)

    try {
      const formData = new FormData()
      if (Platform.OS === 'web') {
        const blob = await fetch(pendingUri).then((r) => r.blob())
        formData.append('file', blob, 'gallery.jpg')
      } else {
        formData.append('file', { uri: pendingUri, name: 'gallery.jpg', type: 'image/jpeg' } as any)
      }

      const params = new URLSearchParams({
        clubId: String(activeClubId),
        teamId: String(teamId),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      })

      const res = await fetch(`${API_URL}/api/gallery/upload?${params.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) throw new Error(await res.text())

      const newImg: GalleryImage = await res.json()
      setImages((prev) => [newImg, ...prev])
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert('Error: ' + e.message)
    } finally {
      setUploading(false)
      resetUploadState()
    }
  }

  const handleCancelPicker = () => {
    setShowTeamPicker(false)
    resetUploadState()
  }

  const renderThumb = ({ item }: { item: GalleryImage }) => (
    <TouchableOpacity
      onPress={() => setFullscreenImage(item)}
      activeOpacity={0.85}
      style={[styles.thumb, { width: THUMB_SIZE, height: THUMB_SIZE }]}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} />
    </TouchableOpacity>
  )

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.boton} />
          </View>
        ) : images.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🖼️</Text>
            <Text style={[styles.emptyTitle, { color: c.texto }]}>Sin fotos todavía</Text>
            <Text style={[styles.emptySubtitle, { color: c.subtexto }]}>
              {isPresident
                ? 'Pulsa el botón + para añadir la primera foto'
                : 'El presidente aún no ha subido fotos'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={images}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            renderItem={renderThumb}
            contentContainerStyle={styles.grid}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.boton} />}
          />
        )}

        {isPresident && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: c.boton }]}
            onPress={handleFAB}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.fabIcon}>+</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Visor a pantalla completa */}
      <Modal
        visible={!!fullscreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <Pressable style={styles.fullscreenOverlay} onPress={() => setFullscreenImage(null)}>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage.imageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}

          {/* Caption overlay */}
          {(fullscreenImage?.title || fullscreenImage?.description) && (
            <View style={styles.captionOverlay}>
              {fullscreenImage.title ? (
                <Text style={styles.captionTitle}>{fullscreenImage.title}</Text>
              ) : null}
              {fullscreenImage.description ? (
                <Text style={styles.captionDesc}>{fullscreenImage.description}</Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullscreenImage(null)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Bottom sheet: metadata + selector de equipo */}
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={handleCancelPicker}
      >
        <KeyboardAvoidingView
          style={styles.pickerOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.pickerBackdrop} onPress={handleCancelPicker} />
          <View style={[styles.pickerCard, { backgroundColor: c.fondo }]}>
            <Text style={[styles.pickerTitle, { color: c.texto }]}>Nueva foto</Text>

            {/* Título */}
            <TextInput
              style={[styles.metaInput, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
              placeholder="Título (opcional)"
              placeholderTextColor={c.subtexto}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="next"
            />

            {/* Descripción */}
            <TextInput
              style={[styles.metaInput, styles.metaInputMultiline, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
              placeholder="Descripción (opcional)"
              placeholderTextColor={c.subtexto}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
            />

            <Text style={[styles.pickerSubtitle, { color: c.subtexto }]}>¿A qué equipo va esta foto?</Text>

            <ScrollView style={styles.teamList} showsVerticalScrollIndicator={false}>
              {teams.length === 0 ? (
                <Text style={[styles.pickerEmpty, { color: c.subtexto }]}>No hay equipos activos</Text>
              ) : (
                teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.pickerItem, { borderColor: c.bordeInput }]}
                    onPress={() => handleUpload(team.id)}
                  >
                    <Text style={[styles.pickerItemText, { color: c.texto }]}>🎽 {teamLabel(team)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity onPress={handleCancelPicker} style={styles.pickerCancel}>
              <Text style={{ color: c.subtexto }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  grid: { gap: 2, paddingBottom: 80 },
  thumb: { margin: 1 },
  thumbImage: { width: '100%', height: '100%' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32 },

  // Fullscreen
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: { width: '100%', height: '100%' },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  captionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  captionDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Team picker / metadata sheet
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
    maxHeight: '85%',
  },
  pickerTitle: { fontSize: 17, fontWeight: '700' },
  pickerSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pickerEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  metaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  metaInputMultiline: {
    minHeight: 72,
    paddingTop: 10,
  },
  teamList: { maxHeight: 200 },
  pickerItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerItemText: { fontSize: 15, fontWeight: '500' },
  pickerCancel: { alignItems: 'center', paddingTop: 4 },
})
