import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - 8) / 3)

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
  const { t } = useTranslation()
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
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [pendingUris, setPendingUris] = useState<string[]>([])
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const resetUploadState = () => {
    setPendingUris([])
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
      if (Platform.OS === 'web') window.alert(t('gallery.permissionDenied'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.9,
    })

    if (result.canceled || !result.assets?.length) return

    setPendingUris(result.assets.map((a) => a.uri))
    await fetchTeams()
    setShowTeamPicker(true)
  }

  const handleUpload = async (teamId: number) => {
    if (!pendingUris.length || !activeClubId || !token) return
    setShowTeamPicker(false)
    setUploading(true)

    try {
      const uploaded = await Promise.all(
        pendingUris.map(async (uri) => {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          )

          const formData = new FormData()
          if (Platform.OS === 'web') {
            const blob = await fetch(manipulated.uri).then((r) => r.blob())
            formData.append('file', blob, 'gallery.jpg')
          } else {
            formData.append('file', { uri: manipulated.uri, name: 'gallery.jpg', type: 'image/jpeg' } as any)
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
          return (await res.json()) as GalleryImage
        })
      )

      setImages((prev) => [...uploaded.reverse(), ...prev])
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

  const handleDeleteImage = async () => {
    if (!fullscreenImage) return
    const img = fullscreenImage
    setFullscreenImage(null)
    setImages((prev) => prev.filter((i) => i.id !== img.id))
    try {
      await apiFetch(`/api/gallery/${img.id}?clubId=${activeClubId}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Error deleting image', e)
    }
  }

  const handleOpenEdit = () => {
    if (!fullscreenImage) return
    setEditTitle(fullscreenImage.title ?? '')
    setEditDescription(fullscreenImage.description ?? '')
    setEditMode(true)
  }

  const handleSaveEdit = async () => {
    if (!fullscreenImage) return
    try {
      const res = await apiFetch(`/api/gallery/${fullscreenImage.id}?clubId=${activeClubId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      })
      if (res.ok) {
        const updated: GalleryImage = await res.json()
        setImages((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        setFullscreenImage(updated)
      }
    } catch (e) {
      console.error('Error updating image', e)
    }
    setEditMode(false)
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
            <Text style={[styles.emptyTitle, { color: c.texto }]}>{t('gallery.emptyTitle')}</Text>
            <Text style={[styles.emptySubtitle, { color: c.subtexto }]}>
              {t(isPresident ? 'gallery.emptyPresidentHint' : 'gallery.emptyPlayerHint')}
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
        onRequestClose={() => { setEditMode(false); setFullscreenImage(null) }}
      >
        <Pressable
          style={styles.fullscreenOverlay}
          onPress={() => { if (!editMode) setFullscreenImage(null) }}
        >
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage.imageUrl }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}

          {/* Caption overlay */}
          {!editMode && (fullscreenImage?.title || fullscreenImage?.description) && (
            <View style={styles.captionOverlay}>
              {fullscreenImage.title ? (
                <Text style={styles.captionTitle}>{fullscreenImage.title}</Text>
              ) : null}
              {fullscreenImage.description ? (
                <Text style={styles.captionDesc}>{fullscreenImage.description}</Text>
              ) : null}
            </View>
          )}

          {/* Top-right controls: edit/delete para presidentes + cerrar */}
          <View style={styles.viewerControls}>
            {isPresident && !editMode && (
              <>
                <TouchableOpacity style={styles.viewerBtn} onPress={handleOpenEdit}>
                  <Text style={styles.viewerBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerBtn} onPress={handleDeleteImage}>
                  <Text style={styles.viewerBtnText}>🗑️</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.viewerBtn}
              onPress={() => { setEditMode(false); setFullscreenImage(null) }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Overlay de edición inline */}
          {editMode && fullscreenImage && (
            <Pressable style={styles.editOverlay} onPress={() => {}}>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder={t('gallery.editTitlePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                maxLength={80}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.editInput, styles.editInputMultiline]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('gallery.editDescPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editActionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                  onPress={() => setEditMode(false)}
                >
                  <Text style={styles.editActionText}>{t('gallery.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editActionBtn, { backgroundColor: 'rgba(34,197,94,0.8)' }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.editActionText}>{t('gallery.save')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          )}
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
            <Text style={[styles.pickerTitle, { color: c.texto }]}>
              {pendingUris.length > 1
                ? t('gallery.photosSelected', { count: pendingUris.length })
                : t('gallery.newPhoto')}
            </Text>
            {pendingUris.length > 1 && (
              <Text style={[styles.pickerBatchNote, { color: c.subtexto }]}>
                {t('gallery.batchNote')}
              </Text>
            )}

            {/* Título */}
            <TextInput
              style={[styles.metaInput, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
              placeholder={t('gallery.titlePlaceholder')}
              placeholderTextColor={c.subtexto}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="next"
            />

            {/* Descripción */}
            <TextInput
              style={[styles.metaInput, styles.metaInputMultiline, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
              placeholder={t('gallery.descPlaceholder')}
              placeholderTextColor={c.subtexto}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
            />

            <Text style={[styles.pickerSubtitle, { color: c.subtexto }]}>{t('gallery.teamQuestion')}</Text>

            <ScrollView style={styles.teamList} showsVerticalScrollIndicator={false}>
              {teams.length === 0 ? (
                <Text style={[styles.pickerEmpty, { color: c.subtexto }]}>{t('gallery.noActiveTeams')}</Text>
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
              <Text style={{ color: c.subtexto }}>{t('gallery.cancel')}</Text>
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
  thumb: { margin: 2 },
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

  // Fullscreen viewer
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
  viewerControls: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  viewerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerBtnText: { fontSize: 16 },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: 10,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  editInputMultiline: {
    minHeight: 72,
    paddingTop: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editActionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

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
  pickerBatchNote: { fontSize: 12, marginTop: -4 },
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
