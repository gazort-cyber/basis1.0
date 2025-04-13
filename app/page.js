'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // 获取交易对符号
  useEffect(() => {
    async function fetchSymbols() {
      const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
      const all = await res.json();
      const filtered = all.filter(s => s.symbol.endsWith('USDT'));
      setSymbols(filtered.map(s => s.symbol));
    }
    fetchSymbols();
  }, []);

  // 获取合约数据，并过滤3天前的下架合约
  const fetchData = async () => {
    if (symbols.length === 0) return;

    const currentTime = Date.now();
    const threeDaysAgo = currentTime - 3 * 24 * 60 * 60 * 1000;

    const newData = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const [spotRes, futureRes, premiumRes, borrowRes] = await Promise.all([
            fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
            fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
            fetch(`/api/borrow-status?symbol=${symbol}`)  // 调用新创建的 API 路径
          ]);

          const spot = await spotRes.json();
          const future = await futureRes.json();
          const premium = await premiumRes.json();
          const borrow = await borrowRes.json();

          const spotPrice = parseFloat(spot.price);
          const futurePrice = parseFloat(future.price);
          const basisRate = ((spotPrice - futurePrice) / futurePrice) * 100;
          const lastFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const predictedFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const score = basisRate - predictedFundingRate;

          if (premium.time && Number(premium.time) < threeDaysAgo) {
            return null;
          }

          return {
            symbol,
            spotPrice,
            futurePrice,
            basisRate: basisRate.toFixed(2),
            lastFundingRate: lastFundingRate.toFixed(4),
            predictedFundingRate: predictedFundingRate.toFixed(4),
            score: score.toFixed(2),
            borrowLimit: borrow.borrowLimit.toFixed(2),  // 添加借贷额度
            free: borrow.free.toFixed(2)  // 添加可借余额
          };
        } catch (e) {
          return null;
        }
      })
    );

    const filteredData = newData.filter(Boolean);
    const sortedNormalData = filteredData.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const combinedData = [...sortedNormalData];

    setData(combinedData);
    setLastUpdated(new Date().toLocaleTimeString());
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
      <h1 style={{ marginBottom: 10, textAlign: 'center' }}>币安基差套利工具</h1>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
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

      <div style={{ textAlign: 'center', marginBottom: 15 }}>
        <span>交易对数量: {displayedData.length}</span>
        <span style={{ marginLeft: 20 }}>更新时间: {lastUpdated}</span>
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
            <th>可借余额</th>  {/* 新增列 */}
          </tr>
        </thead>
        <tbody>
          {displayedData.map(row => (
            <tr
              key={row.symbol}
              style={{
                backgroundColor
