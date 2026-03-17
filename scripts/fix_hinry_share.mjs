import { readFileSync, writeFileSync } from 'fs';

const path = 'app/(tabs)/hinry.tsx';
let src = readFileSync(path, 'utf8');

// ── 1. Fix styles: extract shareCard/shareFooter/shareFooterText out of cardShot ─────────────────
const badStylesRe = /  cardShot: \{\s*borderRadius: Radius\.xl,\s*(shareCard: \{[\s\S]*?shareFooterText: \{[\s\S]*?\},)\s*\},/;

const goodCardShot = `  cardShot: {
    borderRadius: Radius.xl,
  },
  shareCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(154, 108, 58, 0.18)',
  },
  shareFooter: {
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center' as const,
  },
  shareFooterText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: TypeScale.caption,
    letterSpacing: 0.8,
  },`;

if (badStylesRe.test(src)) {
  src = src.replace(badStylesRe, goodCardShot);
  console.log('✓ Fixed styles');
} else {
  console.log('ℹ styles may already be correct or pattern not matched');
}

// ── 2. Remove renderShareSnapshot if nested inside renderCard ──────────────────────────────────────
// The nested block starts with (6-space indent) "      const renderShareSnapshot" inside renderCard
// and ends with "      };" before "    const { context, quotes..."
// Find renderCard, then find and remove any nested renderShareSnapshot inside it
const renderCardIdx = src.indexOf('\n  const renderCard = (day: HinryDay, isToday: boolean) => {');
if (renderCardIdx !== -1) {
  const afterRenderCard = src.slice(renderCardIdx);
  // Look for nested renderShareSnapshot (indented deeper than component scope)
  const nestedStart = afterRenderCard.indexOf('\n      const renderShareSnapshot = ');
  const nestedStartShort = afterRenderCard.indexOf('\n    const renderShareSnapshot = ');
  const nestedIdx = nestedStart !== -1 ? nestedStart : (nestedStartShort !== -1 ? nestedStartShort : -1);
  if (nestedIdx !== -1) {
    // Find the closing "};" of the nested function
    // Count braces after the "= (day" to find where it closes
    const fnStart = renderCardIdx + nestedIdx;
    const bodyStart = src.indexOf(') => {', fnStart) + ') => {'.length;
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    // i now points right after the closing '}' of the function body
    // skip the ';' if present
    if (src[i] === ';') i++;
    // remove from fnStart (the '\n') through i
    src = src.slice(0, fnStart) + src.slice(i);
    console.log('✓ Removed nested renderShareSnapshot from inside renderCard');
  } else {
    console.log('ℹ No nested renderShareSnapshot found inside renderCard');
  }
} else {
  console.log('ℹ renderCard not found');
}

// ── 3. Ensure renderShareSnapshot exists at component scope (before renderCard) ──────────────────
const componentScopeMarker = '\n  const renderShareSnapshot = (day: HinryDay, isToday: boolean) => {';
const alreadyAtScope = src.includes(componentScopeMarker + '\n    const {') ||
  // check it's NOT inside renderCard
  (() => {
    const idx = src.indexOf(componentScopeMarker);
    if (idx === -1) return false;
    // Check if it's at 2-space indent (component scope) and not preceded by renderCard opening
    const before = src.slice(Math.max(0, idx - 200), idx);
    return !before.includes('const renderCard = (day: HinryDay, isToday: boolean) => {');
  })();

if (!alreadyAtScope) {
  const renderShareSnapshotFn = `
  const renderShareSnapshot = (day: HinryDay, isToday: boolean) => {
    const { context, quotes, reflection, invitationIntro, invitationItems } = buildStructuredContent(day);
    const label = isToday ? 'Hoy' : 'Ayer';
    const mascot = isToday ? HINRY_HOY : HINRY_AYER;
    const liturgicalTitle = titleMap[day.date] ?? day.title ?? label;
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -(screenW + 400), top: 0 }}>
        <ViewShot
          ref={(ref) => { shareViewRefs.current[day.date] = ref; }}
          options={{ format: 'png', quality: 0.95 }}>
          <View
            collapsable={false}
            style={[styles.shareCard, { backgroundColor: themed.surface, width: screenW - Spacing.lg * 2 }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardTopText}>
                <Text style={styles.cardDate}>{day.date}</Text>
                <Text style={styles.cardLabel}>{liturgicalTitle}</Text>
                <View style={styles.cardBadge}>
                  <Text style={[styles.cardBadgeText, { color: themed.tint }]}>{label}</Text>
                </View>
              </View>
              <Image source={mascot} style={styles.cardMascot} resizeMode="contain" />
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Contexto breve</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{context || buildHinryText(day)}</Text>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Frases clave del Evangelio</Text>
              {quotes.length ? (
                quotes.map((quote, qi) => (
                  <View key={\`sq-\${qi}\`} style={[styles.quoteCard, { borderColor: themed.tint }]}>
                    <Text style={[styles.quoteText, { color: themed.text }]}>{quote}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.sectionParagraph, { color: themed.text }]}>{day.hinry.mensaje_central}</Text>
              )}
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Reflexión</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{reflection}</Text>
            </View>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: themed.tint }]}>Invitación para el día</Text>
              <Text style={[styles.sectionParagraph, { color: themed.text }]}>{invitationIntro}</Text>
              <View style={styles.invitationList}>
                {invitationItems.length ? (
                  invitationItems.map((item, ii) => (
                    <View key={\`si-\${ii}\`} style={styles.invitationRow}>
                      <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                      <Text style={[styles.invitationText, { color: themed.text }]}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.invitationRow}>
                    <Text style={[styles.invitationBullet, { color: themed.tint }]}>•</Text>
                    <Text style={[styles.invitationText, { color: themed.text }]}>{day.hinry.cierre}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.shareFooter, { borderTopColor: Colors[colorScheme].border }]}>
              <Text style={[styles.shareFooterText, { color: themed.muted }]}>Hinry · Evangelio diario</Text>
            </View>
          </View>
        </ViewShot>
      </View>
    );
  };
`;
  // Insert before "  const renderCard"
  src = src.replace('\n  const renderCard = (day: HinryDay, isToday: boolean) => {', renderShareSnapshotFn + '\n  const renderCard = (day: HinryDay, isToday: boolean) => {');
  console.log('✓ Added renderShareSnapshot at component scope');
} else {
  console.log('ℹ renderShareSnapshot already at component scope');
}

writeFileSync(path, src);
console.log('✓ File written successfully');
