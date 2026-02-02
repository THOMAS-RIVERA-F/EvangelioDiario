import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    i += 1;
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

function inferLiturgicalType(title) {
  if (!title) return 'Feria';
  const match = title.match(/\(([^)]+)\)\s*$/);
  if (match) return match[1].trim();
  const lower = title.toLowerCase();
  if (lower.includes('domingo')) return 'Domingo';
  if (lower.includes('solemnidad')) return 'Solemnidad';
  if (lower.includes('fiesta')) return 'Fiesta';
  if (lower.includes('memoria')) return 'Memoria';
  return 'Feria';
}

function readingsReasonHint(liturgicalType, count) {
  const type = (liturgicalType || '').toLowerCase();
  if (count >= 4) {
    return 'hoy es un dia grande para la comunidad, por eso escuchamos mas lecturas y el salmo';
  }
  if (type.includes('memoria') || type.includes('feria')) {
    return 'es un dia sencillo en el camino, por eso tenemos una lectura, el salmo y el evangelio';
  }
  if (type.includes('domingo') || type.includes('solemnidad') || type.includes('fiesta')) {
    return 'hoy celebramos en comunidad, por eso escuchamos mas lecturas';
  }
  return 'hoy es un dia sencillo y vamos directo al corazon del evangelio';
}

function buildReadingsPayload(readingSets) {
  const sets = Array.isArray(readingSets) ? readingSets : [];
  const readings = [];
  sets.forEach((set, setIndex) => {
    const items = Array.isArray(set.readings) ? set.readings : [];
    items.forEach((reading) => {
      const verses = Array.isArray(reading.verses) ? reading.verses : [];
      const text = verses
        .map((verse) => {
          const number = verse.number ? `${verse.number} ` : '';
          return `${number}${normalizeText(verse.text || '')}`;
        })
        .join(' ');
      readings.push({
        setIndex: setIndex + 1,
        type: normalizeText(reading.type || ''),
        reference: normalizeText(reading.reference || ''),
        text,
      });
    });
  });
  return readings;
}

function formatKeyDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}${month}${year}`;
}

function buildPrompt(day, liturgicalType, readings, reasonHint) {
  const types = readings.map((reading) => reading.type).filter(Boolean);
  const lines = [
    'Eres Hinry. Hablas como alguien que vive la fe, cercano, humilde y real.',
    'Acompanias, no ensenas desde arriba. No hablas de Dios como objeto; hablas desde caminar con El.',
    'Tono: positivo, claro, cercano, agradecido. Sin miedo, culpa, amenaza ni juicio. No moralices ni des ordenes.',
    'Lenguaje: espanol natural latino, frases cortas o medias. Evita frases perfectas.',
    'Nunca uses estas formulas: "Este evangelio nos invita", "Podemos reflexionar", "La lectura nos ensena".',
    'Usa un nosotros comunitario: "nos", "hoy vivimos", "a muchos nos pasa".',
    'Incluye guinos cotidianos: cansancio, trabajo, familia, dudas, silencios. Sin historias largas.',
    'No expliques dogmas ni cites documentos. No tecnicismos liturgicos sin explicar.',
    'Siempre sereno, agradecido, cercano; nunca euforico.',
    'Escribe como si hablaras en voz baja a alguien sentado al lado.',
    '',
    'Cumple esta estructura EXACTA y breve:',
    '1) Contexto del dia: 2-3 frases. Explica tipo de dia y por que hoy se lee esto. No repitas el titulo completo.',
    '2) Explicacion general: 1 parrafo, 1-3 frases. Conecta lecturas y evangelio en una sola idea.',
    '3) Mensaje central: 1 sola frase fuerte, sin comillas.',
    '4) Agradecimiento: 1 frase o lista corta (1-3 items), concreta y cotidiana.',
    '5) Cierre humano: 1 frase, cercana, nada solemne.',
    'Texto total < 1 minuto.',
    '',
    'Datos del dia (no inventes):',
    `Fecha: ${day.date}`,
    `Titulo: ${normalizeText(day.title || '')}`,
    `Tipo liturgico: ${liturgicalType}`,
    `Cantidad de lecturas: ${readings.length}`,
    `Tipos de lecturas: ${types.join(', ')}`,
    `Razon sugerida para la cantidad de lecturas: ${reasonHint}`,
    'Incluye la cantidad de lecturas y la razon en contexto o explicacion.',
    '',
    'Lecturas (para entender el evangelio y el dia):',
  ];

  let currentSet = null;
  readings.forEach((reading) => {
    if (currentSet !== reading.setIndex) {
      currentSet = reading.setIndex;
      lines.push(`Set ${currentSet}:`);
    }
    lines.push(`- ${reading.type} (${reading.reference}): ${reading.text}`);
  });

  lines.push('');
  lines.push('Devuelve SOLO JSON con las claves:');
  lines.push(
    'contexto (array 2-3 frases), explicacion (array 1-3 frases), mensaje_central (string), agradecimiento (array 1-3 items), cierre (string).',
  );
  lines.push('Cada item de contexto y explicacion debe ser una sola frase.');
  lines.push('No agregues campos extra ni texto fuera del JSON.');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input || 'data/lecturas_2026.json');

  const start = args.start;
  const end = args.end;
  if (!start || !end) {
    console.error('Usage: node scripts/generate_hinry_prompts.mjs --start YYYY-MM-DD --end YYYY-MM-DD [--out path]');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const days = Array.isArray(raw.days) ? raw.days : [];
  const selected = days
    .filter((day) => day.date >= start && day.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!selected.length) {
    console.error('No days matched the selection');
    process.exit(1);
  }

  const outputPath =
    args.out ||
    path.resolve(
      process.cwd(),
      `data/hinry_prompts_gpt5_${start.replace(/-/g, '')}_${end.replace(/-/g, '')}.json`,
    );

  const output = {};

  selected.forEach((day) => {
    const readings = buildReadingsPayload(day.reading_sets || []);
    const liturgicalType = inferLiturgicalType(normalizeText(day.title || ''));
    const reasonHint = readingsReasonHint(liturgicalType, readings.length);
    const prompt = buildPrompt(day, liturgicalType, readings, reasonHint);
    const keyDate = formatKeyDate(day.date);
    const key = `prompt_para_gpt5_${keyDate}`;
    output[key] = prompt;
  });

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${selected.length} prompts to ${path.relative(process.cwd(), outputPath)}`);
}

main();
