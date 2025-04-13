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
          };
        } catch (e) {
          return null;
        }
      })
    );

    const filteredData = newData.filter(Boolean).sort((a, b) => {
      // 基差得分绝对值大于10的标红并放到最后面
      if (Math.abs(b.score) > 10) return 1;
      if (Math.abs(a.score) > 10) return -1;
      return b.score - a.score;
    });

    setData(filteredData);
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

  // 计算基差得分区间的交易对数量
  const calculateScoreRanges = () => {
    const ranges = {};
    for (let i = -10; i <= 10; i += 0.5) {
      ranges[i] = 0;
    }

    data.forEach(item => {
      const score = parseFloat(item.score);
      for (let i = -10; i <= 10; i += 0.5) {
        if (score >= i && score < i + 0.5) {
          ranges[i]++;
          break;
        }
      }
    });

    return ranges;
  };

  const scoreRanges = calculateScoreRanges();

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

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
        {Object.keys(scoreRanges).map(range => {
          if (scoreRanges[range] > 0) {
            return (
              <div key={range} style={{ marginRight: 20 }}>
                <span>{`[${range}, ${parseFloat(range) + 0.5})`}: {scoreRanges[range]}</span>
              </div>
            );
          }
          return null;
        })}
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
                backgroundColor: Math.abs(row.score) > 10 ? '#ffcccc' : (parseFloat(row.score) > 1 ? '#fff4d6' : 'white'),
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
        每60秒自动刷新，按“基差率 - 预期资金费率”排序，高亮显示套利得分大于1的币种，基差得分大于10的异常值标红并放在最后。
      </p>
    </main>
  );
}
