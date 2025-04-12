'use client'
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);

  useEffect(() => {
    async function fetchSymbols() {
      const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
      const all = await res.json();
      const filtered = all.filter(s => s.symbol.endsWith('USDT'));
      setSymbols(filtered.map(s => s.symbol));
    }
    fetchSymbols();
  }, []);

  useEffect(() => {
    if (symbols.length === 0) return;

    async function fetchData() {
      const newData = await Promise.all(symbols.slice(0, 50).map(async (symbol) => {
        try {
          const [spotRes, futureRes, fundingRes] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
          ]);

          const spot = await spotRes.json();
          const future = await futureRes.json();
          const funding = await fundingRes.json();

          const spotPrice = parseFloat(spot.price);
          const futurePrice = parseFloat(future.price);
          const basisRate = ((futurePrice - spotPrice) / spotPrice * 100);
          const fundingRate = (parseFloat(funding[0]?.fundingRate || 0) * 100);
          const score = basisRate - fundingRate;

          return {
            symbol,
            spotPrice,
            futurePrice,
            basisRate: basisRate.toFixed(2),
            fundingRate: fundingRate.toFixed(4),
            score: score.toFixed(2)
          };
        } catch {
          return null;
        }
      }));

      const filteredData = newData.filter(Boolean).sort((a, b) => b.score - a.score);
      setData(filteredData);
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [symbols]);

  return (
    <main style={{ padding: 20 }}>
      <h1>币安基差套利工具</h1>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>币种</th>
            <th>现货价</th>
            <th>合约价</th>
            <th>基差率%</th>
            <th>资金费率%</th>
            <th>套利得分</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.symbol}>
              <td>{row.symbol}</td>
              <td>{row.spotPrice}</td>
              <td>{row.futurePrice}</td>
              <td>{row.basisRate}</td>
              <td>{row.fundingRate}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12 }}>每30秒自动刷新，按“基差率 - 资金费率”排序</p>
    </main>
  );
}