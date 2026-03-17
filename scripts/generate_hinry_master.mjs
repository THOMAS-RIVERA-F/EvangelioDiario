import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    index += 1;
    args[key] = value;
  }
  return args;
}

function maybeFixMojibake(value) {
  if (!value || typeof value !== 'string') return value;
  if (!/[ÃÂâ€]/.test(value)) return value;
  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8');
    if (fixed.includes('\uFFFD')) return value;
    return fixed;
  } catch {
    return value;
  }
}

function normalizeText(value) {
  const fixed = maybeFixMojibake(value);
  return String(fixed ?? '').replace(/\s+/g, ' ').trim();
}

function flattenReadings(day) {
  const sets = Array.isArray(day.reading_sets) ? day.reading_sets : [];
  return sets.flatMap((set) => {
    const readings = Array.isArray(set.readings) ? set.readings : [];
    return readings;
  });
}

function getEvangelioReading(day) {
  const readings = flattenReadings(day);
  const byType = readings.find((reading) =>
    normalizeText(reading?.type || '').toLowerCase().includes('evangelio'),
  );
  if (byType) return byType;
  return readings[0] || null;
}

function collectVerses(evangelio) {
  return (Array.isArray(evangelio?.verses) ? evangelio.verses : [])
    .map((verse, index) => ({
      number: normalizeText(verse?.number || `${index + 1}`),
      text: normalizeText(verse?.text || ''),
      index,
    }))
    .filter((verse) => verse.text.length > 0);
}

function scoreVerse(verseText) {
  const lower = verseText.toLowerCase();
  let score = 0;

  if (verseText.length >= 45 && verseText.length <= 220) score += 3;
  if (/dijo jes[uú]s|respondi[oó] jes[uú]s|jes[uú]s.*dijo/.test(lower)) score += 5;
  if (/yo soy|no temas|venid|s[ií]gueme|cree|creed|luz|reino|misericordia/.test(lower)) score += 4;
  if (/farise|disc[ií]pulos|multitud|pueblo|ciego|enfermo|pecado|perd[oó]n/.test(lower)) score += 2;
  if (/\?|¡/.test(verseText)) score += 1;

  return score;
}

function pickKeyVerses(reference, verses) {
  const scored = verses
    .map((verse) => ({
      ...verse,
      score: scoreVerse(verse.text),
    }))
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();
  for (const verse of scored) {
    if (seen.has(verse.text)) continue;
    seen.add(verse.text);
    unique.push(verse);
    if (unique.length === 2) break;
  }

  if (!unique.length && verses.length) unique.push(verses[0]);
  if (unique.length === 1 && verses.length > 1) {
    const fallback = verses.find((verse) => verse.text !== unique[0].text) || verses[0];
    unique.push(fallback);
  }

  return unique.map((verse) => `“${verse.text}” (${reference}, v.${verse.number})`);
}

function scoreContextVerse(verseText, index) {
  const lower = verseText.toLowerCase();
  let score = 0;

  if (index === 0) score += 1;
  if (verseText.length >= 35 && verseText.length <= 220) score += 4;
  if (/dijo jes[uú]s|respondi[oó] jes[uú]s|jes[uú]s.*dijo/.test(lower)) score += 6;
  if (/yo soy|para que|si no|cree|cre[eé]is|luz|vida|reino|misericordia|verdad/.test(lower)) score += 5;
  if (/enfermo|ciego|sano|vivo|pecado|perd[oó]n|padre|hijo/.test(lower)) score += 3;
  if (/entonces|al o[ií]r|oy[oó]|se encontr[oó]|pregunt/.test(lower)) score += 2;
  if (/^dos d[ií]as despu[eé]s|^despu[eé]s de esto|^entonces vino de nuevo|^sal[ií]o de all[ií]/.test(lower)) {
    score -= 6;
  }

  return score;
}

function scoreSceneVerse(verseText, index) {
  const lower = verseText.toLowerCase();
  let score = scoreContextVerse(verseText, index);

  if (/enfermo|ciego|paral[ií]tico|hijo|mujer|hombre|niñ|funcionario|piscina|multitud|pobre|mendigo/.test(lower)) score += 6;
  if (/hab[ií]a|estaba|acudi[oó]|lleg[oó]/.test(lower)) score += 2;
  if (/profeta no le honran|dos d[ií]as despu[eé]s|despu[eé]s de esto/.test(lower)) score -= 4;

  return score;
}

function scoreResponseVerse(verseText, index) {
  const lower = verseText.toLowerCase();
  let score = scoreContextVerse(verseText, index);

  if (/jes[uú]s le dijo|respondi[oó] jes[uú]s|le contest[oó]|v[eé]te|lev[aá]ntate|cree|est[aá] vivo|quieres curarte/.test(lower)) score += 7;
  if (/crey[oó]|obedeci[oó]|se march[oó]|se postr[oó]/.test(lower)) score += 3;
  return score;
}

function classifyVerseTheme(verseText) {
  const lower = verseText.toLowerCase();
  if (/ciego|luz|ver|vean|tinieblas/.test(lower)) return 'luz';
  if (/enfermo|sano|vivo|cur[oó]|salud|camilla/.test(lower)) return 'sanacion';
  if (/pecado|perd[oó]n|misericord/.test(lower)) return 'misericordia';
  if (/cre[eé]|fe|confi/.test(lower)) return 'fe';
  if (/pregunt|duda|farise|disc[ií]pulos|s[aá]bado/.test(lower)) return 'conflicto';
  if (/hijo|padre|familia/.test(lower)) return 'familia';
  return 'general';
}

function isWeakStarterVerse(verseText) {
  const lower = normalizeText(verseText).toLowerCase();
  return /^(dos d[ií]as despu[eé]s|despu[eé]s de esto|entonces vino de nuevo|sal[ií]o de all[ií]|hab[ií]a all[ií])/.test(lower);
}

function isHumanSceneVerse(verseText) {
  const lower = normalizeText(verseText).toLowerCase();
  return /hombre|mujer|hijo|enfermo|ciego|paral[ií]tico|funcionario|estaba|hab[ií]a|multitud|piscina|se encontr[oó]/.test(lower);
}

function buildVerseInsight(verseText) {
  const theme = classifyVerseTheme(verseText);

  if (theme === 'luz') {
    return 'Aquí el Evangelio enseña que Jesús no se queda en el síntoma: quiere abrir la mirada interior para que la persona vea su vida desde Dios y no desde la resignación.';
  }
  if (theme === 'sanacion') {
    return 'Este punto muestra que la fe no evade el dolor humano; al contrario, lo presenta delante de Jesús y espera de Él una palabra que transforma la realidad.';
  }
  if (theme === 'misericordia') {
    return 'La enseñanza central aquí es que Dios no reduce a nadie a su pasado: ofrece misericordia, conversión y una oportunidad real de vida nueva.';
  }
  if (theme === 'fe') {
    return 'Este versículo subraya que creer es confiar antes de ver todo resuelto; esa confianza abre camino a procesos de sanación y madurez espiritual.';
  }
  if (theme === 'conflicto') {
    return 'El texto deja ver una tensión humana muy actual: podemos tener información religiosa y aun así no comprender a Jesús si no hay apertura del corazón.';
  }
  if (theme === 'familia') {
    return 'Aquí aparece la dimensión familiar de la fe: cuando una persona se acerca a Jesús, su esperanza también sostiene a quienes ama.';
  }

  return 'Este punto ilumina una decisión concreta: dejar que la Palabra sea criterio real para actuar hoy y no solo una idea bonita.';
}

function pickContextPoints(verses) {
  if (!verses.length) return [];

  const strongCandidates = verses.filter((verse) => !isWeakStarterVerse(verse.text));
  const scenePoolBase = strongCandidates.length ? strongCandidates : verses;
  const cutIndex = Math.max(1, Math.floor(verses.length * 0.45));
  const earlyScenePool = scenePoolBase.filter((verse) => verse.index <= cutIndex);
  const scenePool = earlyScenePool.length ? earlyScenePool : scenePoolBase;

  const earliestHumanScene =
    scenePool.find((verse) => isHumanSceneVerse(verse.text)) ||
    scenePool[0] ||
    verses[0];

  const meaningfulScene = earliestHumanScene;

  const scored = verses
    .map((verse, index) => ({
      ...verse,
      contextScore: scoreResponseVerse(verse.text, index),
      theme: classifyVerseTheme(verse.text),
    }))
    .sort((a, b) => b.contextScore - a.contextScore);

  const second =
    scored.find(
      (verse) =>
        verse.text !== meaningfulScene.text &&
        verse.contextScore >= 6 &&
        classifyVerseTheme(verse.text) !== classifyVerseTheme(meaningfulScene.text),
    ) ||
    scored.find((verse) => verse.text !== meaningfulScene.text && verse.contextScore >= 5) ||
    scored.find((verse) => verse.text !== meaningfulScene.text) ||
    verses[Math.min(1, verses.length - 1)];

  return [meaningfulScene, second].filter(Boolean);
}

function detectThemes(textBlob) {
  const lower = textBlob.toLowerCase();
  const themeDefinitions = [
    {
      id: 'luz',
      regex: /luz|ciego|vista|ver|tinieblas/,
      reflection:
        'Este pasaje nos muestra que Jesús no solo sana por fuera: también abre la mirada interior para reconocer la verdad de Dios en lo cotidiano.',
      action: ['abre un momento de silencio para escuchar a Dios', 'pide luz para tomar una decisión pendiente'],
    },
    {
      id: 'misericordia',
      regex: /misericord|compasi[oó]n|perd[oó]n|pecador/,
      reflection:
        'Aquí vemos el corazón misericordioso del Señor: no humilla, no condena primero, sino que levanta y devuelve dignidad.',
      action: ['acércate con humildad a Dios tal como estás', 'haz hoy un gesto concreto de perdón'],
    },
    {
      id: 'confianza',
      regex: /no temas|fe|cree|creed|confi|espera/,
      reflection:
        'La Palabra insiste en que la fe no es teoría, es confiar cuando no se entiende todo y seguir caminando sostenidos por Dios.',
      action: ['repite durante el día: “Señor, en ti confío”', 'da un paso de fe en eso que vienes postergando'],
    },
    {
      id: 'discipulado',
      regex: /disc[ií]pulos|s[ií]gueme|seguir|misi[oó]n|envi/,
      reflection:
        'Jesús forma discípulos en medio de la vida real: llama, corrige y envía para servir, no para quedarse cómodos.',
      action: ['pregúntate a quién puedes servir hoy', 'cuida tus palabras para que también anuncien esperanza'],
    },
    {
      id: 'conflicto',
      regex: /farise|divisi[oó]n|rechaz|echaron|acus/,
      reflection:
        'El Evangelio también toca la tensión y el conflicto: permanecer en la verdad a veces cuesta, pero el Señor no abandona a quien le es fiel.',
      action: ['elige la verdad aunque te cueste', 'responde con paz donde hoy hay tensión'],
    },
  ];

  const matched = themeDefinitions.filter((theme) => theme.regex.test(lower));
  if (!matched.length) {
    return {
      reflection:
        'Jesús entra en nuestra historia concreta y nos enseña a vivir con fe, esperanza y amor en medio de los desafíos diarios.',
      actions: ['haz una pausa para agradecer la vida', 'termina el día revisando dónde viste a Dios hoy'],
    };
  }

  const reflectionParts = matched.slice(0, 2).map((theme) => theme.reflection);
  const actions = matched.flatMap((theme) => theme.action).slice(0, 3);

  return {
    reflection: reflectionParts.join(' '),
    actions,
  };
}

function inferCelebrationKind(title) {
  const normalized = normalizeText(title).toLowerCase();
  if (normalized.includes('domingo')) return 'domingo';
  if (normalized.includes('solemnidad')) return 'solemnidad';
  if (normalized.includes('fiesta')) return 'fiesta';
  if (normalized.includes('memoria')) return 'memoria';
  return 'feria';
}

function trimThought(text, max = 180) {
  const cleaned = normalizeText(text);
  if (cleaned.length <= max) return cleaned;
  const truncated = cleaned.slice(0, max);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, Math.max(lastSpace, 0))}...`;
}

function buildContext(title, celebrationKind, reference, verses) {
  const points = pickContextPoints(verses);

  const introsByKind = {
    domingo: `En ${title}, el Evangelio (${reference}) nos ayuda a leer la semana con ojos de fe.`,
    solemnidad: `En ${title}, el Evangelio (${reference}) nos revela con claridad el corazón de esta celebración.`,
    fiesta: `En ${title}, el Evangelio (${reference}) propone un camino concreto para vivir esta fiesta con sentido.`,
    memoria: `En ${title}, el Evangelio (${reference}) ilumina decisiones muy concretas de la vida diaria.`,
    feria: `En el Evangelio de hoy (${reference}), Jesús nos enseña a interpretar lo que vivimos con más profundidad.`,
  };

  const intro = introsByKind[celebrationKind] || introsByKind.feria;

  const analysisA = points[0]
    ? `Punto clave 1: ${trimThought(points[0].text, 170)} ${buildVerseInsight(points[0].text)}`
    : 'Punto clave 1: Jesús toma la iniciativa y se acerca a la realidad concreta de las personas.';

  const analysisB = points[1]
    ? `Punto clave 2: ${trimThought(points[1].text, 170)} ${buildVerseInsight(points[1].text)}`
    : 'Punto clave 2: el texto invita a responder con fe práctica y no solo con palabras.';

  return [intro, `${analysisA} ${analysisB}`];
}

function buildReflection(themeReflection, keyQuotes) {
  const quoteAnchor = keyQuotes[0]
    ? `Una frase que sostiene esta reflexión es ${keyQuotes[0]}.`
    : 'Esta Palabra hoy nos llama a mirar la vida con más verdad y esperanza.';

  const explanation =
    'Cuando esta enseñanza baja a la vida diaria, cambia la forma de enfrentar el miedo, el conflicto y las decisiones importantes del día.';

  const closure =
    'La fe madura cuando pasamos de solo escuchar a obedecer con libertad interior, respondiendo con el estilo de Jesús en lo concreto.';

  return [themeReflection, quoteAnchor, explanation, closure];
}

function buildCentralMessage(keyQuotes) {
  if (!keyQuotes.length) {
    return 'Mensaje central: Jesús está contigo hoy, incluso en lo que no entiendes todavía.';
  }
  return `Mensaje central: ${keyQuotes[0]} Esta palabra no es solo bonita; es una dirección concreta para vivir este día con fe.`;
}

function buildInvitation(actions, celebrationKind, liturgicalType) {
  const celebrationTone =
    celebrationKind === 'domingo' || celebrationKind === 'solemnidad' || celebrationKind === 'fiesta'
      ? 'Vivámoslo con alegría de comunidad'
      : 'Vivámoslo con constancia y corazón humilde';

  const normalizedType = normalizeText(liturgicalType || '').toLowerCase();
  const liturgyTag = normalizedType ? `en este día ${normalizedType}` : 'en este día';

  const items = [
    `${celebrationTone} ${liturgyTag}.`,
    ...actions,
    'al final del día, comparte con alguien una palabra de esperanza que te haya tocado hoy',
  ];

  return items.slice(0, 4);
}

function buildHinryDay(day) {
  const evangelio = getEvangelioReading(day);
  const reference = normalizeText(evangelio?.reference || 'Evangelio del día');
  const verses = collectVerses(evangelio);

  const title = normalizeText(day.title || 'Feria');
  const liturgicalType = normalizeText(day.color || '');
  const celebrationKind = inferCelebrationKind(title);

  const textBlob = verses.map((verse) => verse.text).join(' ');
  const keyQuotes = pickKeyVerses(reference, verses);
  const { reflection: themeReflection, actions } = detectThemes(textBlob);

  const contexto = buildContext(title, celebrationKind, reference, verses);
  const explicacion = buildReflection(themeReflection, keyQuotes);
  const mensajeCentral = buildCentralMessage(keyQuotes);
  const invitaciones = buildInvitation(actions, celebrationKind, liturgicalType);

  const text = [
    `${title}.`,
    ...contexto,
    'Frases clave del Evangelio:',
    ...keyQuotes,
    ...explicacion,
    mensajeCentral,
    'Invitación del día:',
    ...invitaciones.map((item) => `- ${item}`),
  ].join(' ');

  return {
    date: day.date,
    title,
    liturgical_type: liturgicalType,
    hinry: {
      contexto,
      explicacion,
      mensaje_central: mensajeCentral,
      agradecimiento: invitaciones,
      cierre: 'Hinry camina contigo: Dios sigue obrando hoy, también en tu historia.',
      text,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input || 'data/lecturas_2026.json');
  const outPath = args.out || path.resolve(process.cwd(), 'data/hinry_master_2026.json');

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const days = Array.isArray(raw.days) ? raw.days : [];

  const output = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      path: path.relative(process.cwd(), inputPath).replace(/\\/g, '/'),
      year: raw.year,
      total_days: raw.total_days,
    },
    days: days.map((day) => buildHinryDay(day)),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${output.days.length} days to ${path.relative(process.cwd(), outPath)}`);
}

main();
