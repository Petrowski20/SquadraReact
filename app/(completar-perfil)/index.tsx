import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import LogoSimbolo from "../../components/LogoSimbolo";
import { apiFetch } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/useTheme";

type DocType = "DNI" | "NIE" | "PASSPORT";

const DOC_TYPES: { label: string; value: DocType }[] = [
  { label: "DNI", value: "DNI" },
  { label: "NIE", value: "NIE" },
  { label: "Passport", value: "PASSPORT" },
];

const DOC_PLACEHOLDER: Record<DocType, string> = {
  DNI: "12345678A",
  NIE: "X1234567A",
  PASSPORT: "AAB123456",
};

export default function CompletarPerfil() {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState<DocType>("DNI");
  const [docNumber, setDocNumber] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      const fullName: string = meta.full_name ?? "";
      const parts = fullName.split(" ");
      setFirstName(meta.given_name ?? parts[0] ?? "");
      setLastName(meta.family_name ?? parts.slice(1).join(" ") ?? "");
    });
  }, []);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !docNumber.trim()) {
      setErrorMessage("Todos los campos son obligatorios.");
      return;
    }
    if (phone.length < 9) {
      setErrorMessage("El teléfono no es válido (mínimo 9 dígitos).");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await apiFetch("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: `+34${phone}`,
          docType,
          docNumber: docNumber.trim().toUpperCase(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setErrorMessage(text || "No se pudo guardar el perfil.");
        return;
      }

      router.replace("/(selector)");
    } catch {
      setErrorMessage("Error de conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.fondo }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <LogoSimbolo
        size={700}
        color={c.colorMarca}
        style={[styles.watermark, { opacity: c.marcaAguaOpacity }]}
      />

      <ScrollView
        contentContainerStyle={styles.outer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.formContainer, { paddingVertical: isSmallScreen ? 20 : 32 }]}>

          <View style={[styles.headerContainer, { marginBottom: isSmallScreen ? 16 : 28 }]}>
            <LogoSimbolo size={isSmallScreen ? 48 : 60} color={c.colorMarca} style={styles.logo} />
            <Text style={[styles.titulo, { color: c.colorMarca, fontSize: isSmallScreen ? 26 : 32 }]}>
              Completa tu perfil
            </Text>
            <Text style={[styles.subtitulo, { color: c.subtexto }]}>
              Necesitamos algunos datos adicionales
            </Text>
          </View>

          <Text style={[styles.label, { color: c.subtexto }]}>Nombre *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholderTextColor={c.subtexto}
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: c.subtexto }]}>Apellidos *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
            value={lastName}
            onChangeText={setLastName}
            placeholderTextColor={c.subtexto}
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: c.subtexto }]}>Tipo de documento *</Text>
          <View style={styles.radioGroup}>
            {DOC_TYPES.map((type) => {
              const active = docType === type.value;
              return (
                <TouchableOpacity
                  key={type.value}
                  disabled={isLoading}
                  style={[
                    styles.radioButton,
                    { borderColor: active ? c.boton : c.bordeInput, backgroundColor: active ? `${c.boton}18` : c.input },
                  ]}
                  onPress={() => { setDocType(type.value); setDocNumber(""); }}
                >
                  <View style={[styles.radioCircle, { borderColor: active ? c.boton : c.bordeInput }]}>
                    {active && <View style={[styles.radioCircleFill, { backgroundColor: c.boton }]} />}
                  </View>
                  <Text style={[styles.radioText, { color: active ? c.boton : c.texto }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: c.subtexto }]}>Número de documento *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
            value={docNumber}
            onChangeText={setDocNumber}
            placeholder={DOC_PLACEHOLDER[docType]}
            placeholderTextColor={c.subtexto}
            autoCapitalize="characters"
            editable={!isLoading}
          />

          <Text style={[styles.label, { color: c.subtexto }]}>Teléfono *</Text>
          <View style={styles.phoneRow}>
            <View style={[styles.countryBadge, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
              <Text style={{ color: c.texto, fontWeight: "bold" }}>🇪🇸 +34</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto, marginBottom: 0 }]}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={9}
              placeholder="600000000"
              placeholderTextColor={c.subtexto}
              editable={!isLoading}
            />
          </View>

          {errorMessage !== "" && (
            <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
              <Text style={{ color: c.error, fontSize: 13, textAlign: "center", fontWeight: "500" }}>
                ⚠️ {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: isLoading ? c.bordeInput : c.boton }]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={c.botonTexto} />
              : <Text style={[styles.buttonText, { color: c.botonTexto }]}>Guardar y continuar</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  watermark: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -350 }, { translateY: -350 }] },
  outer: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
  formContainer: { maxWidth: 440, width: "100%", alignSelf: "center", paddingHorizontal: 28 },
  headerContainer: { alignItems: "center" },
  logo: { marginBottom: 12 },
  titulo: { fontFamily: "SquadraStencil", textAlign: "center", letterSpacing: 2, marginBottom: 6 },
  subtitulo: { fontSize: 14, textAlign: "center", opacity: 0.8, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 7, marginTop: 4, letterSpacing: 0.2 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16, fontSize: 15 },
  phoneRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  countryBadge: { paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  errorBanner: { padding: 13, borderWidth: 1, borderRadius: 12, marginBottom: 16, marginTop: 4 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 8, marginBottom: 20 },
  buttonText: { fontWeight: "bold", fontSize: 16 },
  radioGroup: { flexDirection: "row", gap: 8, marginBottom: 16 },
  radioButton: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, padding: 11 },
  radioCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioCircleFill: { width: 8, height: 8, borderRadius: 4 },
  radioText: { fontSize: 13, fontWeight: "600" },
});
