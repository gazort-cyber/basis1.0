// app/api/funding/route.js
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');

  const res = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
  const data = await res.json();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
