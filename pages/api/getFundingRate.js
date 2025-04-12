// pages/api/getFundingRate.js
export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const fundingResponse = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
    const fundingData = await fundingResponse.json();

    if (fundingData.code) {
      return res.status(400).json({ error: fundingData.msg });
    }

    // Return the necessary data from Binance API
    const result = {
      lastFundingRate: fundingData[0]?.lastFundingRate || 0,
      interestRate: fundingData[0]?.interestRate || 0
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data from Binance' });
  }
}
