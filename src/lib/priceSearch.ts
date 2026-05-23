import type { LivePriceResult } from '@/types';

// ─── Predefined Malaysian / regional supplier sites ───────────────────────────
// The AI picks from these for recommendations; Tavily searches them for live prices.

export const PREDEFINED_SUPPLIERS = [
  // ── E-commerce / catalogue (most likely to have visible prices) ──
  { name: 'RS Components Malaysia', domain: 'my.rs-online.com', category: 'general' },
  { name: 'element14 Malaysia', domain: 'my.element14.com', category: 'general' },
  { name: 'Lazada Industrial', domain: 'www.lazada.com.my', category: 'general' },

  // ── Pumps ──
  { name: 'Grundfos Malaysia', domain: 'www.grundfos.com', category: 'pump' },
  { name: 'KSB Malaysia', domain: 'www.ksb.com', category: 'pump' },
  { name: 'WILO Malaysia', domain: 'www.wilo.com', category: 'pump' },
  { name: 'Ebara Malaysia', domain: 'www.ebara.com', category: 'pump' },
  { name: 'Sulzer', domain: 'www.sulzer.com', category: 'pump' },
  { name: 'Flowserve Malaysia', domain: 'www.flowserve.com', category: 'pump' },

  // ── Valves ──
  { name: 'Crane Flow Solutions Malaysia', domain: 'www.craneco.com', category: 'valve' },
  { name: 'KITZ Malaysia', domain: 'www.kitz.co.jp', category: 'valve' },
  { name: 'Emerson Malaysia', domain: 'www.emerson.com', category: 'valve' },
  { name: 'Spirax Sarco Malaysia', domain: 'www.spiraxsarco.com', category: 'valve' },
  { name: 'Alfa Laval Malaysia', domain: 'www.alfalaval.com', category: 'valve' },

  // ── Instrumentation ──
  { name: 'Endress+Hauser Malaysia', domain: 'www.endress.com', category: 'instrument' },
  { name: 'Yokogawa Malaysia', domain: 'www.yokogawa.com', category: 'instrument' },
  { name: 'Honeywell Malaysia', domain: 'www.honeywell.com', category: 'instrument' },
  { name: 'ABB Malaysia', domain: 'new.abb.com', category: 'instrument' },
  { name: 'Siemens Malaysia', domain: 'www.siemens.com', category: 'instrument' },
  { name: 'WIKA Malaysia', domain: 'www.wika.com', category: 'instrument' },

  // ── Pneumatics / Hydraulics / Filtration ──
  { name: 'Parker Hannifin Malaysia', domain: 'www.parker.com', category: 'pneumatic' },
  { name: 'SMC Malaysia', domain: 'www.smcpneumatics.com.my', category: 'pneumatic' },
  { name: 'Festo Malaysia', domain: 'www.festo.com', category: 'pneumatic' },
  { name: 'Bosch Rexroth Malaysia', domain: 'www.boschrexroth.com', category: 'hydraulic' },
  { name: 'Donaldson Malaysia', domain: 'www.donaldson.com', category: 'filter' },
  { name: 'Pall Malaysia', domain: 'www.pall.com', category: 'filter' },

  // ── Piping / Fittings ──
  { name: 'Swagelok Malaysia', domain: 'www.swagelok.com', category: 'fitting' },
  { name: 'GF Piping Systems Malaysia', domain: 'www.gfps.com', category: 'fitting' },
  { name: 'Victaulic Malaysia', domain: 'www.victaulic.com', category: 'fitting' },

  // ── Compressors ──
  { name: 'Atlas Copco Malaysia', domain: 'www.atlascopco.com', category: 'compressor' },
];

// Domains list for Tavily include_domains filter
export const SUPPLIER_DOMAINS = PREDEFINED_SUPPLIERS.map((s) => s.domain);

// ─── Price extraction helpers ──────────────────────────────────────────────────

function extractMyrPrice(text: string): number | null {
  // Match patterns like: RM 1,234.56 / MYR 1234 / RM1234.50
  const patterns = [
    /RM\s*([\d,]+(?:\.\d{1,2})?)/i,
    /MYR\s*([\d,]+(?:\.\d{1,2})?)/i,
    /price[:\s]+RM\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (price > 0 && price < 50_000_000) return price; // sanity bound
    }
  }
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ─── Main search function ──────────────────────────────────────────────────────

export async function searchComponentPrices(
  components: Array<{ id: string; name: string; model: string; supplier: string }>
): Promise<LivePriceResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return components.map((c) => ({ componentId: c.id, found: false }));
  }

  // Run all searches in parallel
  const results = await Promise.allSettled(
    components.map(async (c): Promise<LivePriceResult> => {
      const query = `${c.name} ${c.model} ${c.supplier} price Malaysia MYR`;

      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_domains: SUPPLIER_DOMAINS,
          max_results: 5,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(12_000), // 12 s per search
      });

      if (!res.ok) return { componentId: c.id, found: false };

      const data = await res.json();
      const hits: Array<{ url: string; title: string; content: string }> =
        data.results ?? [];

      // 1. Try to find a result with an actual MYR price
      for (const hit of hits) {
        const combined = `${hit.title} ${hit.content}`;
        const price = extractMyrPrice(combined);
        if (price) {
          return {
            componentId: c.id,
            found: true,
            price_myr: price,
            price_text: `RM ${price.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`,
            source_name: hostOf(hit.url),
            source_url: hit.url,
          };
        }
      }

      // 2. No price visible — still return the best product-page link
      if (hits.length > 0) {
        return {
          componentId: c.id,
          found: true,
          price_text: 'Request Quotation',
          source_name: hostOf(hits[0].url),
          source_url: hits[0].url,
        };
      }

      return { componentId: c.id, found: false };
    })
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { componentId: components[i].id, found: false }
  );
}
