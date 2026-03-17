import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://www.vaticannews.va/es/evangelio-de-hoy';
const INPUT_PATH = path.resolve(process.cwd(), 'data/lecturas_2026.json');
const OUTPUT_PATH = INPUT_PATH;
const YEAR = 2026;
const WAIT_MS = 260;
const RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(dateIso) {
  const [year, month, day] = dateIso.split('-');
  return `${BASE_URL}/${year}/${month}/${day}.html`;
}

function extractLiturgicalTitle(html) {
  const blockMatch = html.match(/class="indicazioneLiturgica"[\s\S]*?<span>([\s\S]*?)<\/span>/i);
  if (!blockMatch) return null;
  return blockMatch[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTitle(dateIso) {
  const url = buildUrl(dateIso);
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; HinryCalendarBot/1.0)',
          accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return { status: 'missing', title: null, url };
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const title = extractLiturgicalTitle(html);
      if (!title) return { status: 'parse-miss', title: null, url };
      return { status: 'ok', title, url };
    } catch (error) {
      if (attempt === RETRIES) {
        return { status: 'error', title: null, url, error: String(error) };
      }
      await sleep(300 * (attempt + 1));
    }
  }
  return { status: 'error', title: null, url, error: 'Unknown' };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const days = Array.isArray(raw.days) ? raw.days : [];

  const targetDays = days.filter((day) => String(day.date || '').startsWith(`${YEAR}-`));

  let updated = 0;
  let missing = 0;
  let parseMiss = 0;
  let errors = 0;

  for (let index = 0; index < targetDays.length; index += 1) {
    const day = targetDays[index];
    const result = await fetchTitle(day.date);

    if (result.status === 'ok' && result.title) {
      day.title = result.title;
      updated += 1;
    } else if (result.status === 'missing') {
      missing += 1;
    } else if (result.status === 'parse-miss') {
      parseMiss += 1;
    } else {
      errors += 1;
      console.log(`error ${day.date}: ${result.error || 'unknown'} (${result.url})`);
    }

    if ((index + 1) % 25 === 0 || index === targetDays.length - 1) {
      console.log(`progress ${index + 1}/${targetDays.length} | updated=${updated} missing=${missing} parseMiss=${parseMiss} errors=${errors}`);
    }

    await sleep(WAIT_MS);
  }

  raw.scraped_source = {
    ...(raw.scraped_source || {}),
    vatican_liturgical_titles: {
      synced_at: new Date().toISOString(),
      base_url: BASE_URL,
      year: YEAR,
      total_target_days: targetDays.length,
      updated,
      missing,
      parse_miss: parseMiss,
      errors,
    },
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log(`done. updated=${updated} missing=${missing} parseMiss=${parseMiss} errors=${errors}`);
}

main();
