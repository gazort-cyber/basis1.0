// app/api/borrow-status/route.js

import crypto from 'crypto';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol'); // 例如：BTCUSDT

  // 获取 API Key 和 Secret
  const API_KEY = process.env.BINANCE_API_KEY;
  const API_SECRET = process.env.BINANCE_API_SECRET;

  const timestamp = Date.now(); // 当前时间戳（毫秒）
  
  // 请求参数
  const params = new URLSearchParams({
    symbol: symbol,
    timestamp: timestamp.toString(),
  });

  // 生成签名
  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(params.toString())
    .digest('hex');

  const url = `https://api.binance.com/sapi/v1/margin/isolated/pair?${params.toString()}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': API_KEY,
      },
    });

    const data = await response.json();

    if (data.msg) {
      return new Response(JSON.stringify({ error: data.msg }), { status: 400 });
    }

    const borrowLimit = parseFloat(data.quoteAsset.borrowLimit) - parseFloat(data.quoteAsset.borrowed);
    return new Response(JSON.stringify({
      borrowLimit: borrowLimit,
      free: data.quoteAsset.free,
      symbol: data.symbol,
    }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error fetching borrow status' }), { status: 500 });
  }
}
