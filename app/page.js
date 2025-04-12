'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchSymbols() {
      const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
      const all = await res.json();
      const filtered = all.filter(s => s.symbol.endsWith('USDT'));
      setSymbols(filtered.map(s => s.symbol));
    }
    fetchSymbols();
  }, []);

  const fetchData = async () => {
    if (symbols.length === 0) return;

    const newData = await Promise.all(
      symbols.slice(0, 100).map(async (symbol) => {
        try {
          const [spotRes, futureRes, premiumRes] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
          ]);

          const spot = await spotRes.json();
          const future = await futureRes.json();
          const premium = await premiumRes.json();

          const spotPrice = parseFloat(spot.price);
          const futurePrice = parseFloat(future.price);
          const basisRate = ((futurePrice - spotPrice) / spotPrice) * 100;
          const lastFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const predictedFundingRate = parseFloat(premium.predictedFundingRate || 0) * 100;
          const score = basisRate - predictedFundingRate;

          return {
            symbol,
            spotPrice,
            futurePrice,
            basisRate: basisRate.toFixed(2),
            lastFundingRate: lastFundingRate.toFixed(4),
            predictedFundingRate: predictedFundingRate.toFixed(4),
            score: score.toFixed(2),
          };
        } catch (e) {
          return null;
        }
      })
    );

    const filteredData = newData.filter(Boolean).sort((a, b) => b.score - a.score);
    setData(filteredData);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [symbols]);

  const displayedData = data.filter(item =>
    item.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 10 }}>币安基差套利工具</h1>

      <div style={{ marginBottom: 15 }}>
        <input
          type="text"
          placeholder="搜索币种..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            marginRight: 10
