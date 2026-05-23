import { NextRequest, NextResponse } from 'next/server';
import { searchComponentPrices } from '@/lib/priceSearch';

export const maxDuration = 60; // Tavily searches can be slow in parallel

export async function POST(request: NextRequest) {
  try {
    const { components } = await request.json();

    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json({ error: 'components array is required' }, { status: 400 });
    }

    const results = await searchComponentPrices(components);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[/api/price-check]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Price check failed' },
      { status: 500 }
    );
  }
}
