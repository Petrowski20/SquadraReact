import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WebNavBar from "../../components/WebNavBar";
import { useAuthStore } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/useTheme";

function DrawerContent({ navigation }: { navigation: any }) {
  const c = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const profile = useAuthStore((state: any) => state.profile);
  const clubName = useAuthStore(
    (state: any) => state.activeClubName || "Mi Club",
  );
  const activeRole = useAuthStore((state: any) => state.activeRole);
  const logout = useAuthStore((state: any) => state.logout);

  const esCoach = activeRole === "COACH" || activeRole === "PRESIDENT";
  const esPresidente = activeRole === "PRESIDENT";

  const ITEMS_COMUNES = [
    { ruta: "inicio", icono: "🏠", label: t("nav.home") },
    { ruta: "calendario", icono: "📅", label: t("nav.calendar") },
    { ruta: "tablon", icono: "📢", label: t("nav.board") },
    { ruta: "mi-club", icono: "🏆", label: t("nav.myClub") },
    { ruta: "campos", icono: "📍", label: t("nav.fields") },
  ];

  const ITEMS_ROL = [
    ...(esCoach
      ? [
          {
            ruta: "gestion-coach",
            icono: "🎽",
            label: t("nav.coachManagement"),
          },
        ]
      : []),
    ...(esPresidente
      ? [
          {
            ruta: "gestion-presidente",
            icono: "👑",
            label: t("nav.presidentManagement"),
          },
        ]
      : []),
  ];

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      logout();
      router.replace("/(auth)");
    } catch (err: any) {
      Alert.alert(
        "Error al cerrar sesión",
        err?.message ?? "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      );
    }
  };

  return (
    <View style={[styles.drawerContainer, { backgroundColor: c.fondo }]}>
      {/* Header del Drawer con foto de perfil */}
      <View style={[styles.drawerHeader, { borderBottomColor: c.bordeInput }]}>
        <View
          style={[
            styles.drawerAvatar,
            { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}35` },
          ]}
        >
          {profile?.photoUrl ? (
            <Image
              source={{ uri: profile.photoUrl }}
              style={styles.drawerAvatarImage}
            />
          ) : (
            <Text style={[styles.drawerAvatarText, { color: c.boton }]}>
              {profile?.firstName?.charAt(0) || "U"}
            </Text>
          )}
        </View>
        <View style={styles.drawerUserInfo}>
          <Text style={[styles.drawerUserName, { color: c.texto }]}>
            {profile?.firstName
              ? `${profile.firstName} ${profile.lastName || ""}`
              : "Usuario"}
          </Text>
          <Text style={[styles.drawerClubName, { color: c.subtexto }]}>
            {clubName}
          </Text>
          <View
            style={[
              styles.rolBadge,
              { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}35` },
            ]}
          >
            <Text style={[styles.rolBadgeText, { color: c.boton }]}>
              {activeRole || "SIN ROL"}
            </Text>
          </View>
        </View>
      </View>

      {/* Items comunes */}
      <View style={styles.drawerSection}>
        {ITEMS_COMUNES.map((item) => (
          <TouchableOpacity
            key={item.ruta}
            style={styles.drawerItem}
            onPress={() => {
              navigation.navigate(item.ruta);
              navigation.closeDrawer();
            }}
          >
            <Text style={styles.drawerItemIcon}>{item.icono}</Text>
            <Text style={[styles.drawerItemLabel, { color: c.texto }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Items por rol */}
      {ITEMS_ROL.length > 0 && (
        <>
          <View
            style={[styles.drawerDivider, { borderTopColor: c.bordeInput }]}
          >
            <Text style={[styles.drawerDividerText, { color: c.subtexto }]}>
              Gestión
            </Text>
          </View>
          <View style={styles.drawerSection}>
            {ITEMS_ROL.map((item) => (
              <TouchableOpacity
                key={item.ruta}
                style={styles.drawerItem}
                onPress={() => {
                  navigation.navigate(item.ruta);
                  navigation.closeDrawer();
                }}
              >
                <Text style={styles.drawerItemIcon}>{item.icono}</Text>
                <Text style={[styles.drawerItemLabel, { color: c.texto }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Footer */}
      <View style={styles.drawerFooter}>
        <TouchableOpacity
          onPress={handleLogout}
          style={[
            styles.cerrarSesionBtn,
            { borderColor: "#ef444435", backgroundColor: "#ef444410" },
          ]}
        >
          <Text style={styles.cerrarSesionText}>🚪 {t("nav.logout")}</Text>
        </TouchableOpacity>
        <Text style={[styles.drawerVersion, { color: c.subtexto }]}>
          Squadra v1.0
        </Text>
      </View>
    </View>
  );
}

export default function ClubLayout() {
  const c = useTheme();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  // Obtenemos el rol actual para configurar las pantallas del Drawer
  const activeRole = useAuthStore((state: any) => state.activeRole);
  const profile = useAuthStore((state: any) => state.profile);
  const esPresidente = activeRole === "PRESIDENT";
  const esCoach = activeRole === "COACH" || activeRole === "PRESIDENT";

  const screens = (
    <>
      <Drawer.Screen name="inicio" />
      <Drawer.Screen name="calendario" />
      <Drawer.Screen name="tablon" />
      <Drawer.Screen name="mi-club" />

      {/* Estas pantallas se ocultan del menú si el usuario no tiene el rol adecuado */}
      <Drawer.Screen
        name="gestion-coach"
        options={{ drawerItemStyle: { display: esCoach ? "flex" : "none" } }}
      />
      <Drawer.Screen
        name="gestion-presidente"
        options={{
          drawerItemStyle: { display: esPresidente ? "flex" : "none" },
        }}
      />
      <Drawer.Screen name="campos" />
      <Drawer.Screen
        name="mi-perfil"
        options={{ drawerItemStyle: { display: "none" } }}
      />
    </>
  );

  if (isWeb) {
    return (
      <>
        <WebNavBar />
        <Drawer
          drawerContent={(props) => <DrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: "transparent" },
          }}
        >
          {screens}
        </Drawer>
      </>
    );
  }

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: c.fondo },
        headerTintColor: c.texto,
        headerShadowVisible: false,
        drawerStyle: { width: 280 },
        headerLeft: () => (
          <TouchableOpacity
            style={styles.hamburger}
            onPress={() => navigation.toggleDrawer()}
          >
            <Text style={[styles.hamburgerIcon, { color: c.texto }]}>☰</Text>
          </TouchableOpacity>
        ),
        headerTitle: () => (
          <TouchableOpacity onPress={() => navigation.navigate("inicio")}>
            <Text style={styles.headerBrand}>SQUADRA</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            style={styles.avatarHeaderBtn}
            onPress={() => navigation.navigate("mi-perfil")}
          >
            <View
              style={[
                styles.avatarHeaderCircle,
                {
                  backgroundColor: `${c.boton}18`,
                  borderColor: `${c.boton}35`,
                },
              ]}
            >
              {profile?.photoUrl ? (
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={styles.avatarHeaderImage}
                />
              ) : (
                <Text style={[styles.avatarHeaderText, { color: c.boton }]}>
                  {profile?.firstName?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ),
      })}
    >
      {screens}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  hamburger: {
    marginLeft: 16,
    padding: 4,
  },
  hamburgerIcon: {
    fontSize: 22,
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#C9A84C",
    letterSpacing: 4,
  },
  drawerContainer: {
    flex: 1,
    paddingTop: 60,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  drawerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  drawerAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  drawerAvatarText: {
    fontSize: 22,
    fontWeight: "bold",
  },
  drawerUserInfo: {
    flex: 1,
    gap: 3,
  },
  drawerUserName: {
    fontSize: 15,
    fontWeight: "700",
  },
  drawerClubName: {
    fontSize: 12,
  },
  rolBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  rolBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  drawerSection: {
    paddingHorizontal: 12,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  drawerItemIcon: {
    fontSize: 18,
    width: 28,
    textAlign: "center",
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  drawerDivider: {
    borderTopWidth: 1,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingTop: 12,
  },
  drawerDividerText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  drawerFooter: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    gap: 12,
    alignItems: "center",
  },
  cerrarSesionBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cerrarSesionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  drawerVersion: {
    fontSize: 12,
  },
  avatarHeaderBtn: {
    marginRight: 16,
  },
  avatarHeaderCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarHeaderImage: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  avatarHeaderText: {
    fontSize: 15,
    fontWeight: "bold",
  },
});
