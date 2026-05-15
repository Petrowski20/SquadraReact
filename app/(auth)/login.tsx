import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { isEmpty, isValidEmail } from "../../lib/helper";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

export default function Login() {
  const { t } = useTranslation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 700;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const validateFields = (): boolean => {
    setErrorMessage("");
    if (!isValidEmail(email)) {
      setErrorMessage(t("login.errorEmail", "Introduce un formato de email válido (ej: correo@dominio.com)"));
      return false;
    }
    if (isEmpty(password)) {
      setErrorMessage(t("login.errorPassword", "La contraseña es obligatoria."));
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateFields()) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://squadraapi.onrender.com";
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), password, platform: Platform.OS === 'web' ? 'web' : 'mobile' }),
      });

      if (!response.ok) {
        setIsLoading(false);
        const errorText = await response.text();
        setErrorMessage(errorText || t("login.errorCredentials"));
        return;
      }

      const data = await response.json();
      setAuth(data.token, {
        userId: data.userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        docType: data.docType,
        docNumber: data.docNumber,
        photoUrl: data.photoUrl,
      });
    } catch (err) {
      setErrorMessage(t("common.serverError"));
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

          <LogoSimbolo
            size={isSmallScreen ? 56 : 72}
            color={c.colorMarca}
            style={styles.logo}
          />

          <View style={[styles.headerTextContainer, { marginBottom: isSmallScreen ? 20 : 32 }]}>
            <Text style={[styles.tituloTexto, { color: c.colorMarca, fontSize: isSmallScreen ? 38 : 48 }]}>SQUADRA</Text>
            <Text style={[styles.subtituloTexto, { color: c.colorMarca }]}>DONDE NACE EL FÚTBOL</Text>
          </View>

          <Text style={[styles.label, { color: c.subtexto }]}>{t("login.email", "Email")} *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
            placeholder={t("login.emailPlaceholder", "ejemplo@squadra.com")}
            placeholderTextColor={c.subtexto}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: c.subtexto }]}>{t("login.password", "Contraseña")} *</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
              placeholder={t("login.passwordPlaceholder", "••••••••")}
              placeholderTextColor={c.subtexto}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
            <TouchableOpacity
              style={[styles.eyeButton, { backgroundColor: c.input, borderColor: c.bordeInput }]}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotContainer}
            onPress={() => router.push("/recuperar-password")}
            disabled={isLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.forgotText, { color: c.boton }]}>{t("login.forgotPassword", "¿Olvidaste tu contraseña?")}</Text>
          </TouchableOpacity>

          {errorMessage !== "" && (
            <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
              <Text style={{ color: c.error, fontSize: 13, textAlign: "center", fontWeight: "500" }}>
                ⚠️ {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: isLoading ? c.bordeInput : c.boton }]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={c.botonTexto} />
              : <Text style={[styles.buttonText, { color: c.botonTexto }]}>{t("login.button", "Acceder")}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => router.push("/registro")}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={{ color: c.subtexto }}>{t("login.noAccount", "¿No tienes cuenta?")} </Text>
            <Text style={[styles.link, { color: c.boton }]}>{t("login.registerLink", "Regístrate aquí")}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  watermark: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -350 }, { translateY: -350 }] },
  outer: { flexGrow: 1, justifyContent: "center", paddingBottom: 24 },
  formContainer: { maxWidth: 440, width: "100%", alignSelf: "center", paddingHorizontal: 28 },
  logo: { alignSelf: "center", marginBottom: 8 },
  headerTextContainer: { alignItems: "center" },
  tituloTexto: { fontFamily: "SquadraStencil", textAlign: "center", letterSpacing: 2, lineHeight: 52 },
  subtituloTexto: { fontFamily: "SquadraStencil", fontSize: 13, textAlign: "center", letterSpacing: 4, marginTop: -4, opacity: 0.85 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 7, letterSpacing: 0.2 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16, fontSize: 15 },
  passwordRow: { flexDirection: "row", marginBottom: 8, gap: 8 },
  passwordInput: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  eyeButton: { borderWidth: 1.5, borderRadius: 12, width: 52, alignItems: "center", justifyContent: "center" },
  forgotContainer: { alignSelf: "flex-end", marginBottom: 24, paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: "600" },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  buttonText: { fontWeight: "bold", fontSize: 16, letterSpacing: 0.5 },
  linkContainer: { flexDirection: "row", justifyContent: "center", paddingVertical: 4 },
  link: { fontWeight: "bold" },
  errorBanner: { padding: 13, borderWidth: 1, borderRadius: 12, marginBottom: 16 },
});
