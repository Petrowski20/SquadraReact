import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
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
import { isEmpty, isValidEmail, isValidPassword } from "../../lib/helper";
import { useAuthStore } from "../../lib/store";
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

export default function Register() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;

  // Estados del formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [docType, setDocType] = useState<DocType>("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Estados de control
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [countryCode, setCountryCode] = useState("+34");

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(t("register.permissionDeniedMessage"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const validateFields = (): boolean => {
    setErrorMessage("");
    if (isEmpty(firstName)) {
      setErrorMessage(
        t("register.errorFirstName", "El nombre es obligatorio."),
      );
      return false;
    }
    if (isEmpty(lastName)) {
      setErrorMessage(
        t("register.errorLastName", "Los apellidos son obligatorios."),
      );
      return false;
    }
    if (isEmpty(docNumber)) {
      setErrorMessage(
        t("register.errorDoc", "El número de documento es obligatorio."),
      );
      return false;
    }
    /*
    if (!isValidDocument(docType, docNumber)) {
    setErrorMessage(t("register.errorDocument", { type: docType }) || `El ${docType} no es válido.`)
    return false
  }
    */
    if (!isValidEmail(email)) {
      setErrorMessage(t("register.errorEmail", "Introduce un email válido."));
      return false;
    }
    if (phone.length < 9) {
      setErrorMessage(t("register.errorPhone", "El teléfono no es válido."));
      return false;
    }
    if (!isValidPassword(password)) {
      setErrorMessage(
        t(
          "register.errorPassword",
          "La contraseña debe tener al menos 6 caracteres.",
        ),
      );
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage(
        t("register.errorConfirmPassword", "Las contraseñas no coinciden."),
      );
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateFields()) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const payload = {
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: `${countryCode}${phone}`,
        docType,
        docNumber: docNumber.trim().toUpperCase(),
        photoUrl: profilePhoto || "",
        platform: Platform.OS === "web" ? "web" : "mobile",
      };

      const API_URL =
        process.env.EXPO_PUBLIC_API_URL || "https://squadraapi.onrender.com";
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setIsLoading(false);
        const errorText = await response.text();
        let friendlyMessage = t("register.errorCreate", "Error al crear la cuenta. Inténtalo de nuevo.");
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error_code === "email_exists") {
            friendlyMessage = t("register.errorEmailExists", "Este correo ya está registrado. Prueba a iniciar sesión.");
          } else if (errorData.msg) {
            friendlyMessage = errorData.msg;
          }
        } catch {
          if (errorText.includes("email_exists")) {
            friendlyMessage = t("register.errorEmailExists", "Este correo ya está registrado. Prueba a iniciar sesión.");
          } else if (errorText.includes("uq_profiles_documents") || errorText.includes("doc_type, doc_number")) {
            friendlyMessage = t("register.errorDocExists", "Este documento de identidad ya está registrado.");
          }
        }
        setErrorMessage(friendlyMessage);
        return;
      }

      const data = await response.json();
      setAuth(data.token, { ...data });
      router.replace("/(selector)");
    } catch (error) {
      setErrorMessage(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  const mismatch = confirmPassword !== "" && confirmPassword !== password;

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
        <View
          style={[
            styles.formContainer,
            { paddingVertical: isSmallScreen ? 20 : 32 },
          ]}
        >
          <View
            style={[
              styles.headerTextContainer,
              { marginBottom: isSmallScreen ? 16 : 28 },
            ]}
          >
            <LogoSimbolo
              size={isSmallScreen ? 48 : 60}
              color={c.colorMarca}
              style={styles.logo}
            />
            <Text
              style={[
                styles.tituloTexto,
                { color: c.colorMarca, fontSize: isSmallScreen ? 36 : 44 },
              ]}
            >
              SQUADRA
            </Text>
            <Text style={[styles.subtituloTexto, { color: c.colorMarca }]}>
              DONDE NACE EL FÚTBOL
            </Text>
          </View>

          <TouchableOpacity
            style={styles.photoContainer}
            onPress={pickPhoto}
            disabled={isLoading}
          >
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={[styles.photo, { borderColor: c.boton }]}
              />
            ) : (
              <View
                style={[
                  styles.photoEmpty,
                  { backgroundColor: c.input, borderColor: c.bordeInput },
                ]}
              >
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={[styles.photoText, { color: c.subtexto }]}>
                  {t("register.addPhoto")}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.photoEditBadge,
                { backgroundColor: c.boton, borderColor: c.fondo },
              ]}
            >
              <Text style={styles.photoEditIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.firstName", "Nombre")} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.bordeInput,
                color: c.texto,
              },
            ]}
            value={firstName}
            onChangeText={setFirstName}
            placeholderTextColor={c.subtexto}
          />

          {/* RECUPERADO: Campo de Apellidos */}
          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.lastName", "Apellidos")} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.bordeInput,
                color: c.texto,
              },
            ]}
            value={lastName}
            onChangeText={setLastName}
            placeholderTextColor={c.subtexto}
          />

          {/* RECUPERADO: Tipo de Documento */}
          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.docType", "Tipo de documento")} *
          </Text>
          <View style={styles.radioGroup}>
            {DOC_TYPES.map((type) => {
              const active = docType === type.value;
              return (
                <TouchableOpacity
                  key={type.value}
                  disabled={isLoading}
                  style={[
                    styles.radioButton,
                    {
                      borderColor: active ? c.boton : c.bordeInput,
                      backgroundColor: active ? `${c.boton}18` : c.input,
                    },
                  ]}
                  onPress={() => {
                    setDocType(type.value);
                    setDocNumber("");
                  }}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: active ? c.boton : c.bordeInput },
                    ]}
                  >
                    {active && (
                      <View
                        style={[
                          styles.radioCircleFill,
                          { backgroundColor: c.boton },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.radioText,
                      { color: active ? c.boton : c.texto },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* RECUPERADO: Número de Documento */}
          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.docNumber", { type: docType })} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.bordeInput,
                color: c.texto,
              },
            ]}
            value={docNumber}
            onChangeText={setDocNumber}
            placeholder={DOC_PLACEHOLDER[docType]}
            placeholderTextColor={c.subtexto}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.email", "Email")} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.bordeInput,
                color: c.texto,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={c.subtexto}
          />

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.phone", "Teléfono")} *
          </Text>
          <View style={styles.phoneRow}>
            <View
              style={[
                styles.countryBadge,
                { backgroundColor: c.input, borderColor: c.bordeInput },
              ]}
            >
              <Text style={{ color: c.texto, fontWeight: "bold" }}>
                🇪🇸 {countryCode}
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: c.input,
                  borderColor: c.bordeInput,
                  color: c.texto,
                  marginBottom: 0,
                },
              ]}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={9}
              placeholder="600000000"
              placeholderTextColor={c.subtexto}
            />
          </View>

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.password", "Contraseña")} *{" "}
            <Text style={{ fontWeight: "400", fontSize: 11 }}>(min. 6)</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: c.bordeInput,
                color: c.texto,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={c.subtexto}
          />
          {password.length > 0 && password.length < 6 && (
            <Text
              style={{
                color: c.error,
                fontSize: 12,
                marginTop: -10,
                marginBottom: 12,
                marginLeft: 4,
              }}
            >
              ⚠ min. 6
            </Text>
          )}

          <Text style={[styles.label, { color: c.subtexto }]}>
            {t("register.confirmPassword", "Confirmar contraseña")} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.input,
                borderColor: mismatch ? c.error : c.bordeInput,
                color: c.texto,
              },
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={c.subtexto}
          />

          {errorMessage !== "" && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: `${c.error}15`, borderColor: c.error },
              ]}
            >
              <Text
                style={{
                  color: c.error,
                  fontSize: 13,
                  textAlign: "center",
                  fontWeight: "500",
                }}
              >
                ⚠️ {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: isLoading ? c.bordeInput : c.boton },
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={c.botonTexto} />
            ) : (
              <Text style={[styles.buttonText, { color: c.botonTexto }]}>
                {t("register.button", "Crear cuenta")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => router.replace("/login")}
          >
            <Text style={{ color: c.subtexto }}>{t("register.alreadyAccount")} </Text>
            <Text style={[styles.link, { color: c.boton }]}>{t("register.loginLink")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -350 }, { translateY: -350 }],
  },
  outer: { flexGrow: 1, justifyContent: "center", paddingBottom: 32 },
  formContainer: {
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  headerTextContainer: { alignItems: "center" },
  logo: { marginBottom: 6 },
  tituloTexto: {
    fontFamily: "SquadraStencil",
    textAlign: "center",
    letterSpacing: 2,
  },
  subtituloTexto: {
    fontFamily: "SquadraStencil",
    fontSize: 13,
    textAlign: "center",
    letterSpacing: 4,
    marginTop: -4,
    opacity: 0.85,
  },
  photoContainer: { alignSelf: "center", marginBottom: 24 },
  photo: { width: 96, height: 96, borderRadius: 48, borderWidth: 3 },
  photoEmpty: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoIcon: { fontSize: 24 },
  photoText: { fontSize: 11, fontWeight: "500" },
  photoEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  photoEditIcon: { fontSize: 12 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 15,
  },
  phoneRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  countryBadge: {
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBanner: {
    padding: 13,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: { fontWeight: "bold", fontSize: 16 },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 4,
  },
  link: { fontWeight: "bold" },
  radioGroup: { flexDirection: "row", gap: 8, marginBottom: 16 },
  radioButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 11,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleFill: { width: 8, height: 8, borderRadius: 4 },
  radioText: { fontSize: 13, fontWeight: "600" },
});
