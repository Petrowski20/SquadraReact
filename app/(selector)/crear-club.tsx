import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { apiFetch } from '../../lib/api'
import { parseApiError } from '../../lib/helper'
import { useAuthStore } from '../../lib/store'
import { useTheme } from '../../lib/useTheme'
import ScreenContainer from '../../components/ScreenContainer'

export default function CrearClub() {
  const c = useTheme()
  const { t } = useTranslation()
  const { setActiveClub, setSeason } = useAuthStore()

  const [nombre, setNombre] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [created, setCreated] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clubData, setClubData] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleCrearClub = async () => {
    if (!nombre.trim()) return
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: nombre.trim(),
          logoUrl: logoUrl.trim() || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setClubData(data)
        setCreated(true)
      } else {
        const errorText = await res.text()
        try {
          const data = JSON.parse(errorText)
          setErrorMessage(parseApiError(data.error || data.message, 'No se pudo crear el club.'))
        } catch {
          setErrorMessage(parseApiError(errorText, 'No se pudo crear el club.'))
        }
      }
    } catch {
      setErrorMessage(t('common.serverError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEntrar = async () => {
    if (!clubData) return
    try {
      setActiveClub(clubData.id, clubData.name, "PRESIDENT", null, clubData.logoUrl ?? null)
      const res = await apiFetch(`/api/clubs/${clubData.id}/current-season`)
      if (res.ok) {
        const label = await res.text()
        setSeason(label, label)
      }
      router.replace('/inicio')
    } catch (e) {
      router.replace('/')
    }
  }

  if (created) {
    return (
      <ScreenContainer>
      <View style={[styles.container, { backgroundColor: c.fondo, justifyContent: 'center' }]}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>🏆</Text>
        <Text style={[styles.title, { color: c.texto }]}>{t('createClub.successTitle')}</Text>
        <Text style={[styles.subtitle, { color: c.subtexto }]}>
          {t('createClub.shareCode')}
        </Text>
        <View style={[styles.codeCard, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={[styles.codeLabel, { color: c.subtexto }]}>{t('createClub.invitationCode').toUpperCase()}</Text>
          <Text style={[styles.codeText, { color: c.boton }]}>{clubData?.invitationCode}</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: c.boton, width: '100%' }]}
          onPress={handleEntrar}
        >
          <Text style={styles.buttonText}>{t('createClub.startManaging')}</Text>
        </TouchableOpacity>
      </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: c.fondo }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backText, { color: c.boton }]}>← {t('createClub.back')}</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: c.texto }]}>{t('createClub.pageTitle')}</Text>

          <Text style={[styles.label, { color: c.subtexto }]}>{t('createClub.name')} *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
            placeholder="Ej: UD Atlético Parque"
            placeholderTextColor={c.subtexto}
            value={nombre}
            onChangeText={setNombre}
            maxLength={100}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t('createClub.logoUrl')}{' '}
            <Text style={{ fontStyle: 'italic' }}>{t('common.optional')}</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
            placeholder="https://ejemplo.com/logo.png"
            placeholderTextColor={c.subtexto}
            value={logoUrl}
            onChangeText={setLogoUrl}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleCrearClub}
          />

          {errorMessage !== '' && (
            <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
              <Text style={{ color: c.error, fontSize: 13, fontWeight: '500' }}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: nombre.trim() ? c.boton : c.subtexto + '50', marginTop: 8 }]}
            onPress={handleCrearClub}
            disabled={isSubmitting || !nombre.trim()}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="white" />
              : <Text style={styles.buttonText}>{t('createClub.button')}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, alignSelf: 'flex-start' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 20, color: '#888' },
  label: { fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', padding: 16, borderRadius: 12, borderWidth: 1, fontSize: 16, marginBottom: 20 },
  button: { padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 16, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
  errorBanner: { width: '100%', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  codeCard: { padding: 24, borderRadius: 16, marginBottom: 30, width: '100%', alignItems: 'center', borderWidth: 1 },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  codeText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 8 }
})
