'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

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
            fetch(`/api/borrow-status?symbol=${symbol}`)  // 使用新的 API 路径
          ]);

          const spot = await spotRes.json();
          const future = await futureRes.json();
          const premium = await premiumRes.json();
          const borrow = await borrowRes.json();  // 获取借贷额度数据

          const spotPrice = parseFloat(spot.price);
          const futurePrice = parseFloat(future.price);
          const basisRate = ((spotPrice - futurePrice) / futurePrice) * 100;
          const lastFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const predictedFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
          const score = basisRate - predictedFundingRate;

          // 检查合约是否下架，time 小于3天之前的时间戳
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
            borrowLimit: borrow?.borrowLimit?.toFixed(2) || 'N/A',  // 如果没有借贷数据，显示 'N/A'
            free: borrow?.free?.toFixed(2) || 'N/A'  // 如果没有借贷数据，显示 'N/A'
          };
        } catch (e) {
          return null;
        }
      })
    );

    // 过滤掉 null 值的项并按套利得分的绝对值排序
    const filteredData = newData.filter(Boolean);

    const sortedNormalData = filteredData.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    const combinedData = [...sortedNormalData];

    // 异常值处理：绝对值大于10的放到最后
    const anomalyData = combinedData.filter(item => Math.abs(item.score) > 10);
    const normalData = combinedData.filter(item => Math.abs(item.score) <= 10);

    setData([...normalData, ...anomalyData]);  // 将异常值排到最后
    setLastUpdated(new Date().toLocaleTimeString());
  };

  // 自动每60秒刷新数据
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [symbols]);

  // 筛选显示的数据（根据搜索框输入）
  const displayedData = data.filter(item =>
    item.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 10, textAlign: 'center' }}>币安基差套利工具</h1>

      <div style={{ marginBottom: 15, textAlign: 'center' }}>
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
        <span>交易对数量: {symbols.length}</span>
        <span style={{ marginLeft: 20 }}>最后更新时间: {lastUpdated}</span>
      </div>

      <div style={{ marginBottom: 15, textAlign: 'center' }}>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '80%', margin: '0 auto' }}>
          <thead style={{ backgroundColor: '#f2f2f2' }}>
            <tr>
              <th>币种</th>
              <th>现货价</th>
              <th>合约价</th>
              <th>基差率%</th>
              <th>上次资金费率%</th>
              <th>预期资金费率%</th>
              <th>套利得分</th>
              <th>可借余额</th> {/* 新增列 */}
            </tr>
          </thead>
          <tbody>
            {displayedData.map(row => (
              <tr
                key={row.symbol}
                style={{
                  backgroundColor: Math.abs(parseFloat(row.score)) > 10 ? '#ffcccc' : (parseFloat(row.score) > 1 ? '#fff4d6' : 'white'),
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
                <td>{row.free}</td> {/* 显示可借余额 */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>
        <p>每60秒自动刷新，按“基差率 - 预期资金费率”排序，高亮显示套利得分大于1的币种，异常值（基差得分绝对值大于10）排在最后。</p>
      </div>
    </main>
  );
}
