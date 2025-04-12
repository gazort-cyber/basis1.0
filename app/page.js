'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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

    const newData = await Promise.all(symbols.slice(0, 100).map(async (symbol) => {
      try {
        const [spotRes, futureRes, fundingRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
          fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
          fetch(`/api/funding?symbol=${symbol}`) // ✅ 改为本地 API 路由
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
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 每60秒刷新
    return () => clearInterval(interval);
  }, [symbols]);

  // 筛选后的数据
  const filteredData = data.filter(row => row.symbol.includes(searchTerm.toUpperCase()));

  return (
    <main style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 10 }}>币安基差套利工具</h1>

      <div style={{ marginBottom: 15 }}>
        <input
          type="text"
          placeholder="搜索币种如 BTCUSDT"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '6px 10px',
            marginRight: 10,
            width: 200,
            fontSize: 14
          }}
        />
        <button onClick={fetchData} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          手动刷新
        </button>
      </div>

      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead style={{ backgroundColor: '#f2f2f2' }}>
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
          {filteredData.map(row => (
            <tr key={row.symbol} style={{
              backgroundColor: parseFloat(row.score) > 1 ? '#fff4d6' : 'white',
              cursor: 'pointer'
            }}>
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

      <p style={{ fontSize: 12, marginTop: 10 }}>
        每60秒自动刷新，按“基差率 - 资金费率”排序，高亮显示套利得分大于1的币种
      </p>
    </main>
  );
}
