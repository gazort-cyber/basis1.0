'use client';
import { useEffect, useState, useMemo } from 'react';

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 统计区间数据
  const scoreRanges = useMemo<string[]>(() => {
    const ranges: string[] = [];
    for (let i = -10; i <= 10; i += 0.5) {
      ranges.push(`${i >= 0 ? '+' : ''}${i.toFixed(1)}~${(i + 0.5).toFixed(1)}`);
    }
    return ranges;
  }, []);

  // 统计各区间数量
  const rangeCounts = useMemo<{ [key: string]: number }>(() => {
    const counts: { [key: string]: number } = {};
    scoreRanges.forEach(range => counts[range] = 0);
    
    data.forEach(item => {
      const score = parseFloat(item.score);
      for (const range of scoreRanges) {
        const [min, max] = range.split('~').map(s => parseFloat(s));
        if (score >= min && score < max) {
          counts[range]++;
          break;
        }
      }
    });
    
    return scoreRanges
      .filter(range => counts[range] > 0)
      .reduce((acc, range) => ({
        ...acc,
        [range]: counts[range]
      }), {} as { [key: string]: number });
  }, [data, scoreRanges]);

  // 获取交易对符号
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
        const all = await res.json();
        const filtered = all.filter((s: any) => s.symbol.endsWith('USDT'));
        setSymbols(filtered.map((s: any) => s.symbol));
      } catch (error) {
        console.error('获取交易对失败:', error);
      }
    };
    fetchSymbols();
  }, []);

  // 获取合约数据
  const fetchData = async () => {
    if (symbols.length === 0) return;

    const currentTime = Date.now();
    const threeDaysAgo = currentTime - 3 * 24 * 60 * 60 * 1000;

    try {
      const newData = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const [spotRes, futureRes, premiumRes] = await Promise.all([
              fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
              fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`),
              fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`)
            ]);

            const [spot, future, premium] = await Promise.all([
              spotRes.json(),
              futureRes.json(),
              premiumRes.json()
            ]);

            const spotPrice = parseFloat(spot.price);
            const futurePrice = parseFloat(future.price);
            const basisRate = ((spotPrice - futurePrice) / futurePrice) * 100;
            const lastFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
            const predictedFundingRate = parseFloat(premium.lastFundingRate || 0) * 100;
            const score = basisRate - predictedFundingRate;

            if (premium.time && Number(premium.time) < threeDaysAgo) return null;

            return {
              symbol,
              spotPrice,
              futurePrice,
              basisRate: basisRate.toFixed(2),
              lastFundingRate: lastFundingRate.toFixed(4),
              predictedFundingRate: predictedFundingRate.toFixed(4),
              score: score.toFixed(2),
            };
          } catch (error) {
            console.error(`获取 ${symbol} 数据失败:`, error);
            return null;
          }
        })
      );

      const filteredData = newData
        .filter(Boolean)
        .sort((a, b) => {
          const scoreA = parseFloat(a.score);
          const scoreB = parseFloat(b.score);
          return (scoreB > 10 || scoreB < -10) ? 1 : (scoreA - scoreB);
        });

      setData([...filteredData.filter(d => Math.abs(parseFloat(d.score)) <= 10),
        ...filteredData.filter(d => Math.abs(parseFloat(d.score)) > 10)])
      setLastUpdate(new Date());
    } catch (error) {
      console.error('数据更新失败:', error);
    }
  };

  // 自动刷新
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
      {/* 导航栏 */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottom: '1px solid #eee'
      }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0' }}>基差套利工具</h2>
          <div style={{ color: '#666' }}>
            {Object.entries(rangeCounts).map(([range, count]) => (
              <div key={range} style={{ margin: '2px 0' }}>
                {range}: {count}个
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>交易对: {displayedData.length}/{data.length}</span>
          <span>最后更新: {lastUpdate ? lastUpdate.toLocaleTimeString() : '未更新'}</span>
        </div>
      </nav>

      {/* 搜索和按钮 */}
      <div style={{ marginBottom: 15, display: 'flex', gap: 10 }}>
        <input
          type="text"
          placeholder="搜索币种..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* 数据表格 */}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
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
          {displayedData.map((row) => (
            <tr
              key={row.symbol}
              style={{
                backgroundColor: Math.abs(parseFloat(row.score)) > 10 
                  ? '#ffe6e6' 
                  : parseFloat(row.score) > 1 
                  ? '#fff4d6' 
                  : 'white',
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
        每60秒自动刷新 | 异常值(基差率绝对值>10)已标红置底
      </p>
    </main>
  );
}
