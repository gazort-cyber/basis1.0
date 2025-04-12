'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState("");

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

    const newData = await Promise.all(symbols.slice(0, 50).map(async (symbol) => {
      try {
        const [spotRes, futureRes, fundingRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
          fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
          fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
        ]);

        const spot = await spotRes.json();
        const future = await futureRes.json();
        const funding = await fundingRes.json();

        const spotPrice = parseFloat(spot.price);
        const futurePrice = parseFloat(future.price);
        const predictedFundingRate = parseFloat(funding[0]?.lastFundingRate || 0) * 100; // 预期资金费率
        const previousFundingRate = parseFloat(funding[0]?.interestRate || 0) * 100; // 前一次资金费率
        const basisRate = ((spotPrice - futurePrice) / futurePrice) * 100; // 基差公式调整: (现货 - 合约) / 合约
        const score = basisRate - predictedFundingRate;

        return {
          symbol,
          spotPrice,
          futurePrice,
          basisRate: basisRate.toFixed(2),
          predictedFundingRate: predictedFundingRate.toFixed(4),
          previousFundingRate: previousFundingRate.toFixed(4),
          score: score.toFixed(2)
        };
      } catch {
        return null;
      }
    }));

    const filteredData = newData.filter(Boolean).sort((a, b) => b.score - a.score);
    setData(filteredData);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 每60秒刷新
    return () => clearInterval(interval);
  }, [symbols]);

  return (
    <main style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 10 }}>币安基差套利工具</h1>
      <button
