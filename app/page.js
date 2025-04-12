'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');

  // 获取币安的所有合约
  useEffect(() => {
    async function fetchSymbols() {
      const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
      const all = await res.json();
      const filtered = all.filter(s => s.symbol.endsWith('USDT')); // 只筛选USDT交易对
      setSymbols(filtered.map(s => s.symbol));
    }
    fetchSymbols();
  }, []);

  // 获取每个合约的详细数据
  const fetchData = async () => {
    if (symbols.length === 0) return;

    const newData = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const [spotRes, futureRes, premiumRes] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
          ]);

          const spot = await spotRes.json();
          const future = await futureRes.json();
          const premium = await premiumRes.json();

          // 计算现货价格、期货价格和基差率
          const spotPrice = parseFloat(spot.price);
          const futurePrice = parseFloat(future.price);
          const basisRate = ((futurePrice - spotPrice) / spotPrice) * 100;
          const lastFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const predictedFundingRate = parseFloat(premium.predictedFundingRate || 0) * 100;
          const score = basisRate - predictedFundingRate;

          // 判断是否下架
          const isDelisted = new Date(premium.updateTime).getTime() < Date.now() - 24 * 60 * 60 * 1000; // 24小时未更新

          return {
            symbol,
            spotPrice,
            futurePrice,
            basisRate: basisRate.toFixed(2),
            lastFundingRate: lastFundingRate.toFixed(4),
            predictedFundingRate: predictedFundingRate.toFixed(4),
            score: score.toFixed(2),
            isDelisted,
          };
        } catch (e) {
          return null;
        }
      })
    );

    const filteredData = newData.filter(Boolean);

    // 将无现货价格的合约排到最后
    const sortedData = filteredData.sort((a, b) => {
      if (!a.spotPrice) return 1;  // 没有现货价格的合约排到最后
      if (!b.spotPrice) return -1;
      return b.score - a.score; // 根据套利得分排序
    });

    setData(sortedData);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [symbols]);

  // 搜索过滤
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
            marginRight: 10,
            fontSize: 14,
            width: 200
          }}
        />
        <button
          onClick={fetchData}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: 4
          }}
        >
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
            <th>上次资金费率%</th>
            <th>预期资金费率%</th>
            <th>套利得分</th>
          </tr>
        </thead>
        <tbody>
          {displayedData.map(row => (
            <tr
              key={row.symbol}
              style={{
                backgroundColor: row.isDelisted ? 'red' : (parseFloat(row.score) > 1 ? '#fff4d6' : 'white'),
                cursor: 'pointer'
              }}
            >
              <td>{row.symbol}</td>
              <td>{row.spotPrice}</td>
              <td>{row.futurePrice}</td>
              <td>{row.basisRate}</td>
              <td>{row.lastFundingRate}</td>
              <td>{row.predictedFundingRate}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 12, marginTop: 10 }}>
        每60秒自动刷新，按“基差率 - 预期资金费率”排序，高亮显示套利得分大于1的币种，已下架合约标红
      </p>
    </main>
  );
}
