import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../../lib/useTheme'
import ScreenContainer from '../../components/ScreenContainer'
import { apiFetch } from '../../lib/api'
import { parseApiError } from '../../lib/helper'
import DateTimePicker from '@react-native-community/datetimepicker'

const ROLES = [
  { value: 'PLAYER', label: '⚽ Jugador' },
  { value: 'COACH', label: '🎽 Entrenador' },
  { value: 'RELATIVE', label: '👨‍👧 Familiar' },
  { value: 'OTHER', label: '👤 Otro' },
]

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export default function Unirse() {
  const c = useTheme()
  const { t } = useTranslation()
  const [codigo, setCodigo] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState('PLAYER')
  const [mensaje, setMensaje] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // PLAYER
  const [playerBirthDate, setPlayerBirthDate] = useState('')
  const [showPlayerDatePicker, setShowPlayerDatePicker] = useState(false)
  const [playerPickerDate, setPlayerPickerDate] = useState(new Date(2005, 0, 1))

  // COACH
  const [coachLicense, setCoachLicense] = useState('')

  // RELATIVE
  const [childHasAccount, setChildHasAccount] = useState<boolean | null>(null)
  const [childName, setChildName] = useState('')
  const [newChildFirstName, setNewChildFirstName] = useState('')
  const [newChildLastName, setNewChildLastName] = useState('')
  const [newChildBirthDate, setNewChildBirthDate] = useState('')
  const [showChildDatePicker, setShowChildDatePicker] = useState(false)
  const [childPickerDate, setChildPickerDate] = useState(new Date(2012, 0, 1))

  const handleJoin = async () => {
    setErrorMessage('')
    const cleanCode = codigo.toUpperCase().trim()
    if (!cleanCode || cleanCode.length !== 6) return

    if (rolSeleccionado === 'PLAYER' && !playerBirthDate) {
      setErrorMessage(t('joinClub.errorBirthDate'))
      return
    }
    if (rolSeleccionado === 'RELATIVE' && childHasAccount === null) {
      setErrorMessage(t('joinClub.errorChildAccount'))
      return
    }
    if (rolSeleccionado === 'RELATIVE' && childHasAccount === false) {
      if (!newChildFirstName.trim() || !newChildLastName.trim()) {
        setErrorMessage(t('joinClub.errorChildName'))
        return
      }
    }

    let metadata: Record<string, any> = {}
    if (rolSeleccionado === 'PLAYER') {
      metadata = { birthDate: playerBirthDate }
    } else if (rolSeleccionado === 'COACH' && coachLicense.trim()) {
      metadata = { license: coachLicense.trim() }
    } else if (rolSeleccionado === 'RELATIVE') {
      if (childHasAccount === true) {
        metadata = { childHasAccount: true, childName: childName.trim() }
      } else {
        metadata = {
          childHasAccount: false,
          childFirstName: newChildFirstName.trim(),
          childLastName: newChildLastName.trim(),
          childBirthDate: newChildBirthDate || null,
        }
      }
    }

    setIsLoading(true)
    try {
      const res = await apiFetch('/api/clubs/join', {
        method: 'POST',
        body: JSON.stringify({
          invitationCode: cleanCode,
          requestedRole: rolSeleccionado,
          message: mensaje,
          metadata,
        }),
      })

      if (res.ok) {
        setSent(true)
      } else {
        const errorText = await res.text()
        try {
          const data = JSON.parse(errorText)
          setErrorMessage(parseApiError(data.error || data.message, 'No se pudo unir al club.'))
        } catch {
          setErrorMessage(parseApiError(errorText, 'No se pudo unir al club.'))
        }
      }
    } catch {
      setErrorMessage(t('common.serverError'))
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <ScreenContainer>
        <View style={[styles.successContainer, { backgroundColor: c.fondo }]}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>📩</Text>
          <Text style={[styles.title, { color: c.texto }]}>{t('joinClub.sentTitle')}</Text>
          <Text style={[styles.subtitle, { color: c.subtexto }]}>
            {t('joinClub.sentMessage')}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.boton, width: '100%' }]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.buttonText}>{t('joinClub.understood')}</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    )
  }

  const canSubmit = codigo.length === 6 && !isLoading

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
            <Text style={[styles.backText, { color: c.boton }]}>← {t('joinClub.back')}</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: c.texto }]}>{t('joinClub.joinTitle')}</Text>

          <Text style={[styles.label, { color: c.subtexto }]}>{t('joinClub.invCode')}</Text>
          <TextInput
            style={[styles.codeInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
            placeholder="ABCDEF"
            placeholderTextColor={c.subtexto}
            autoCapitalize="characters"
            maxLength={6}
            value={codigo}
            onChangeText={(text) => setCodigo(text.toUpperCase())}
            returnKeyType="done"
            autoCorrect={false}
          />

          <Text style={[styles.label, { color: c.subtexto }]}>{t('joinClub.roleQuestion')}</Text>
          <View style={styles.rolesGrid}>
            {ROLES.map((rol) => {
              const isSelected = rolSeleccionado === rol.value
              return (
                <TouchableOpacity
                  key={rol.value}
                  style={[
                    styles.rolCard,
                    {
                      backgroundColor: isSelected ? c.boton : c.input,
                      borderColor: isSelected ? c.boton : c.bordeInput,
                    },
                  ]}
                  onPress={() => setRolSeleccionado(rol.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rolText, { color: isSelected ? 'white' : c.texto }]}>
                    {t('joinClub.rol_' + rol.value.toLowerCase())}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* PLAYER */}
          {rolSeleccionado === 'PLAYER' && (
            <View style={styles.extraFields}>
              <Text style={[styles.label, { color: c.subtexto }]}>{t('joinClub.birthDate')} *</Text>
              {Platform.OS === 'web' ? (
                <View style={[styles.webDateWrapper, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                  <input
                    type="date"
                    value={playerBirthDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setPlayerBirthDate(e.target.value)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      fontSize: 15, color: c.texto, outline: 'none', padding: 4,
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: c.input, borderColor: c.bordeInput }]}
                    onPress={() => setShowPlayerDatePicker(true)}
                  >
                    <Text style={{ color: playerBirthDate ? c.texto : c.subtexto, fontSize: 15 }}>
                      {playerBirthDate ? formatDisplayDate(playerBirthDate) : t('joinClub.selectDate')}
                    </Text>
                  </TouchableOpacity>
                  {showPlayerDatePicker && (
                    <DateTimePicker
                      value={playerPickerDate}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={(_, date) => {
                        setShowPlayerDatePicker(Platform.OS === 'ios')
                        if (date) {
                          setPlayerPickerDate(date)
                          setPlayerBirthDate(formatDate(date))
                        }
                      }}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {/* COACH */}
          {rolSeleccionado === 'COACH' && (
            <View style={styles.extraFields}>
              <Text style={[styles.label, { color: c.subtexto }]}>
                {t('joinClub.licenseNumber')}{' '}
                <Text style={{ fontStyle: 'italic' }}>{t('common.optional')}</Text>
              </Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
                placeholder="Ej: RFC-12345"
                placeholderTextColor={c.subtexto}
                value={coachLicense}
                onChangeText={setCoachLicense}
                autoCapitalize="characters"
              />
            </View>
          )}

          {/* RELATIVE */}
          {rolSeleccionado === 'RELATIVE' && (
            <View style={styles.extraFields}>
              <Text style={[styles.label, { color: c.subtexto }]}>{t('joinClub.childHasAccount')} *</Text>
              <View style={styles.radioRow}>
                {([{ label: 'Sí', value: true }, { label: 'No', value: false }] as const).map((opt) => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[
                      styles.radioButton,
                      {
                        backgroundColor: childHasAccount === opt.value ? c.boton : c.input,
                        borderColor: childHasAccount === opt.value ? c.boton : c.bordeInput,
                      },
                    ]}
                    onPress={() => setChildHasAccount(opt.value)}
                  >
                    <Text style={{ color: childHasAccount === opt.value ? 'white' : c.texto, fontWeight: '600' }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {childHasAccount === true && (
                <>
                  <Text style={[styles.label, { color: c.subtexto, marginTop: 12 }]}>
                    {t('joinClub.playerNameHint')}
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
                    placeholder="Nombre completo del jugador"
                    placeholderTextColor={c.subtexto}
                    value={childName}
                    onChangeText={setChildName}
                  />
                </>
              )}

              {childHasAccount === false && (
                <>
                  <Text style={[styles.label, { color: c.subtexto, marginTop: 12 }]}>{t('register.firstName')} *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
                    placeholder="Nombre"
                    placeholderTextColor={c.subtexto}
                    value={newChildFirstName}
                    onChangeText={setNewChildFirstName}
                  />
                  <Text style={[styles.label, { color: c.subtexto, marginTop: 12 }]}>{t('register.lastName')} *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
                    placeholder="Apellidos"
                    placeholderTextColor={c.subtexto}
                    value={newChildLastName}
                    onChangeText={setNewChildLastName}
                  />
                  <Text style={[styles.label, { color: c.subtexto, marginTop: 12 }]}>
                    {t('joinClub.birthDate')}{' '}
                    <Text style={{ fontStyle: 'italic' }}>{t('common.optional')}</Text>
                  </Text>
                  {Platform.OS === 'web' ? (
                    <View style={[styles.webDateWrapper, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                      <input
                        type="date"
                        value={newChildBirthDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setNewChildBirthDate(e.target.value)}
                        style={{
                          width: '100%', background: 'transparent', border: 'none',
                          fontSize: 15, color: c.texto, outline: 'none', padding: 4,
                        }}
                      />
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: c.input, borderColor: c.bordeInput }]}
                        onPress={() => setShowChildDatePicker(true)}
                      >
                        <Text style={{ color: newChildBirthDate ? c.texto : c.subtexto, fontSize: 15 }}>
                          {newChildBirthDate ? formatDisplayDate(newChildBirthDate) : t('joinClub.selectDate')}
                        </Text>
                      </TouchableOpacity>
                      {showChildDatePicker && (
                        <DateTimePicker
                          value={childPickerDate}
                          mode="date"
                          display="default"
                          maximumDate={new Date()}
                          onChange={(_, date) => {
                            setShowChildDatePicker(Platform.OS === 'ios')
                            if (date) {
                              setChildPickerDate(date)
                              setNewChildBirthDate(formatDate(date))
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t('joinClub.messageLabel')}{' '}
            <Text style={{ color: c.subtexto, fontStyle: 'italic' }}>{t('common.optional')}</Text>
          </Text>
          <TextInput
            style={[styles.messageInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]}
            placeholder="Ej: Soy el portero del equipo alevín..."
            placeholderTextColor={c.subtexto}
            multiline
            maxLength={500}
            value={mensaje}
            onChangeText={setMensaje}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: c.subtexto }]}>{mensaje.length}/500</Text>

          {errorMessage !== '' && (
            <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
              <Text style={{ color: c.error, fontSize: 13, fontWeight: '500' }}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: canSubmit ? c.boton : c.subtexto + '50', marginTop: 8 }]}
            onPress={handleJoin}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.buttonText}>{t('joinClub.submitButton')}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, alignItems: 'center' },
  successContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, alignSelf: 'flex-start' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  codeInput: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, fontSize: 32, textAlign: 'center', fontWeight: 'bold', letterSpacing: 8, marginBottom: 24 },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginBottom: 24 },
  rolCard: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, minWidth: '45%', flex: 1, alignItems: 'center' },
  rolText: { fontWeight: '600', fontSize: 14 },
  extraFields: { width: '100%', marginBottom: 24 },
  fieldInput: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  dateButton: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1 },
  webDateWrapper: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1 },
  radioRow: { flexDirection: 'row', gap: 12 },
  radioButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  messageInput: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 90, marginBottom: 4 },
  charCount: { alignSelf: 'flex-end', fontSize: 12, marginBottom: 16 },
  button: { padding: 18, borderRadius: 12, alignItems: 'center', width: '100%' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  errorBanner: { width: '100%', padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, marginTop: 16, marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600' },
})
