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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input || 'data/lecturas_2026.json');
  const outPath =
    args.out || path.resolve(process.cwd(), 'data/hinry_master_2026.json');

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const days = Array.isArray(raw.days) ? raw.days : [];

  const placeholder = args.placeholder || 'hinry debe pensarlo';

  const output = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      path: path.relative(process.cwd(), inputPath).replace(/\\/g, '/'),
      year: raw.year,
      total_days: raw.total_days,
    },
    days: days.map((day) => ({
      date: day.date,
      title: normalizeText(day.title || ''),
      liturgical_type: normalizeText(day.color || ''),
      hinry: {
        contexto: [placeholder, placeholder],
        explicacion: [placeholder],
        mensaje_central: placeholder,
        agradecimiento: [placeholder],
        cierre: placeholder,
        text: placeholder,
      },
    })),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${output.days.length} days to ${path.relative(process.cwd(), outPath)}`);
}

main();
