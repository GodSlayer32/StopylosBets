import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { iconSize, radius, spacing } from "@/constants/theme";
import { useApp } from "@/context/app-context";
import { useTheme } from "@/hooks/use-theme";
import type { Profile } from "@/types";

type Option = {
  id: Profile;
  name: string;
  desc: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const OPTIONS: Option[] = [
  {
    id: "crutches",
    name: "Muletas o lesión temporal",
    desc: "Evitamos escaleras y pendientes fuertes",
    icon: "bandage",
  },
  {
    id: "wheelchair",
    name: "Silla de ruedas",
    desc: "Rampas suaves (≤6%), puertas anchas y ascensores amplios",
    icon: "wheelchair-accessibility",
  },
  {
    id: "lowVision",
    name: "Baja visión",
    desc: "Te guiamos por voz y con alto contraste",
    icon: "eye-outline",
  },
  {
    id: "none",
    name: "Sin necesidades especiales",
    desc: "La ruta más corta",
    icon: "walk",
  },
];

export default function MobilityProfile() {
  const router = useRouter();
  const { profile, setProfile } = useApp();
  const { colors, minTouch } = useTheme();

  const choose = (id: Profile) => {
    if (id !== profile) Haptics.selectionAsync().catch(() => {});
    setProfile(id);
  };

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <View
          style={styles.brand}
          accessible
          accessibilityLabel="Ruta Libre, USM Casa Central"
        >
          <View
            style={[styles.logo, { backgroundColor: colors.primary }]}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={iconSize.md}
              color={colors.primaryText}
            />
          </View>
          <View>
            <AppText variant="heading">Ruta Libre</AppText>
            <AppText variant="caption" color="textMuted">
              USM Casa Central
            </AppText>
          </View>
        </View>
        <AppText variant="display" accessibilityRole="header">
          ¿Cómo te mueves hoy?
        </AppText>
        <AppText color="textMuted">
          Elige tu perfil y te mostramos las rutas que sí funcionan para ti.
        </AppText>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.list} accessibilityRole="radiogroup">
          {OPTIONS.map((o) => {
            const selected = o.id === profile;
            return (
              <Pressable
                key={o.id}
                onPress={() => choose(o.id)}
                accessibilityRole="radio"
                accessibilityLabel={`${o.name}. ${o.desc}`}
                accessibilityState={{ selected, checked: selected }}
                accessibilityHint="Selecciona este perfil de movilidad"
                style={[
                  styles.card,
                  {
                    minHeight: minTouch * 1.5,
                    backgroundColor: selected
                      ? colors.primarySoft
                      : colors.surface,
                    borderColor: selected ? colors.primary : colors.borderStrong,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : colors.surfaceAlt,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={o.icon}
                    size={32}
                    color={selected ? colors.primaryText : colors.text}
                  />
                </View>
                <View style={styles.cardText}>
                  <AppText variant="heading">{o.name}</AppText>
                  <AppText variant="label" color="textMuted">
                    {o.desc}
                  </AppText>
                </View>
                <MaterialCommunityIcons
                  name={selected ? "check-circle" : "circle-outline"}
                  size={28}
                  color={selected ? colors.primary : colors.border}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Continuar"
          icon="arrow-forward"
          fullWidth
          onPress={() => router.replace("/home")}
        />
        <AppText variant="caption" color="textMuted" style={styles.note}>
          Puedes cambiarlo cuando quieras
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { gap: spacing.sm, paddingTop: spacing.lg },
  scroll: { flex: 1 },
  list: { gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: spacing.xs },
  footer: { gap: spacing.sm },
  note: { textAlign: "center" },
});
