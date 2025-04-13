'use client'; 
import { useEffect, useState } from 'react';

export default function Home() { 
  const [data, setData] = useState([]); 
  const [symbols, setSymbols] = useState([]); 
  const [search, setSearch] = useState(''); 
  const [lastUpdated, setLastUpdated] = useState(null);

  
  // 新增的参数和计算逻辑
  const [n, setN] = useState(1000); // 本金默认1000
  const [k, setK] = useState(3); // 杠杆默认3
  const [a, setA] = useState(0.06); // 现货滑点默认6%
  const [b, setB] = useState(0.06); // 合约滑点默认6%
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [maxPosition, setMaxPosition] = useState(null);
  const [upperPrice, setUpperPrice] = useState(null);
  const [lowerPrice, setLowerPrice] = useState(null);

  // 高亮币种列表
  const highlightTokens = [ 
    "1INCHUSDT", "AAVEUSDT", "ADAUSDT", "ADXUSDT", "ARUSDT", "ATOMUSDT", "AUCTIONUSDT", "AVAXUSDT", "BCHUSDT", 
    "BOMEUSDT", "BNBUSDT", "CAKEUSDT", "CFXUSDT", "CHZUSDT", "COMPUSDT", "CRVUSDT", "DASHUSDT", "DEGOUSDT", 
    "DEXEUSDT", "DOGEUSDT", "DOTUSDT", "EGLDUSDT", "ELFUSDT", "ENJUSDT", "ENSUSDT", "ETCUSDT", "ETTUSDT", 
    "FETUSDT", "FILUSDT", "FISUSDT", "FLOWUSDT", "FORTHUSDT", "GALAUSDT", "GRTUSDT", "HARDUSDT", "HBARUSDT", 
    "IOTAUSDT", "IOTXUSDT", "JTOUSDT", "JUPUSDT", "KAVAUSDT", "KSMUSDT", "LINKUSDT", "LPTUSDT", "LTCUSDT", 
    "LUNAUSDT", "MANAUSDT", "MASKUSDT", "MBOXUSDT", "MKRUSDT", "NEARUSDT", "NOTUSDT", "OMUSDT", "ONEUSDT", 
    "OPUSDT", "PENGUUSDT", "PLYTHUSDT", "POLUSDT", "RSUUSDT", "RUNEUSDT", "SANDUSDT", "SEIUSDT", "SHIBUSDT", 
    "SKLUSDT", "SNXUSDT", "SOLUSDT", "STXUSDT", "SUIUSDT", "SUPERUSDT", "THETAUSDT", "TIAUSDT", "TIMUSDT", 
    "TKOUSDT", "TONUSDT", "TRBUSDT", "TROYUSDT", "TRXUSDT", "TURBOUSDT", "UNIUSDT", "UTKUSDT", "VETUSDT", 
    "WIFUSDT", "XRPUSDT", "XTZUSDT", "YFIUSDT", "YGGUSDT", "ZECUSDT", "ZILUSDT", "ZRXUSDT"
  ];

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

    const filteredData = newData.filter(Boolean);

    // 将得分绝对值大于10的项提取出来放到最后面
    const normalData = filteredData.filter(item => Math.abs(parseFloat(item.score)) <= 10);
    const abnormalData = filteredData.filter(item => Math.abs(parseFloat(item.score)) > 10);

    // 将正常数据按套利得分的绝对值从高到低排序，异常数据放到最后
    const sortedNormalData = normalData.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    // 合并正常数据和异常数据
    const combinedData = [...sortedNormalData, ...abnormalData];
    setData(combinedData);
    setLastUpdated(new Date().toLocaleTimeString());
  };

  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval); 
  }, [symbols]);

   // 计算最大仓位、上限价、下限价
const calculatePosition = (spotPrice, futurePrice) => {
  if (isNaN(spotPrice) || isNaN(futurePrice)) {
    alert('价格数据无效');
    return;
  }

  const maxPrice = Math.max(spotPrice, futurePrice,score);
  const maxPosition = (k * n) / maxPrice;

  let upperPrice, lowerPrice;
  if (score > 0) {  // 使用 selectedData.score 来决定套利得分
    upperPrice = Math.max(spotPrice * (1 + (1 - a) / k), futurePrice * (1 - (1 - b) / k));
    lowerPrice = Math.min(spotPrice * (1 + (1 - a) / k), futurePrice * (1 - (1 - b) / k));
  } else { 
    upperPrice = Math.max(spotPrice * (1 - (1 - a) / k), futurePrice * (1 + (1 - b) / k));
    lowerPrice = Math.min(spotPrice * (1 - (1 - a) / k), futurePrice * (1 + (1 - b) / k));
  }

  setMaxPosition(maxPosition);
  setUpperPrice(upperPrice);
  setLowerPrice(lowerPrice);
};
const handleSymbolInput = () => {
  console.log("Selected Symbol:", selectedSymbol);  // 检查输入的币种符号
  console.log("Data Array:", data);  // 检查 data 是否有数据
  const selectedData = data.find(item => item.symbol === selectedSymbol);
  console.log("Selected Data:", selectedData);  // 检查找到的数据
  if (selectedData) {
    calculatePosition(parseFloat(selectedData.spotPrice), parseFloat(selectedData.futurePrice),parseFloat(selectedData.score));
  } else {
    alert('币种数据未找到');
  }
};
  
  const displayedData = [...data] 
    .sort((a, b) => { 
      // 优先考虑高亮币种 
      const isAHighlighted = highlightTokens.includes(a.symbol); 
      const isBHighlighted = highlightTokens.includes(b.symbol); 
      if (isAHighlighted && !isBHighlighted) return -1; // A排在前 
      if (!isAHighlighted && isBHighlighted) return 1; // B排在前 

      // 处理正常值和异常值 
      const isAAbnormal = Math.abs(a.score) > 10; 
      const isBAbnormal = Math.abs(b.score) > 10; 
      if (isAAbnormal && !isBAbnormal) return 1; // A是异常值，排到后面 
      if (!isAAbnormal && isBAbnormal) return -1; // B是异常值，排到后面 

      // 如果两个币种都不是异常，按得分绝对值排序
      return Math.abs(b.score) - Math.abs(a.score); 
    }) 
    .filter(item => item.symbol.toLowerCase().includes(search.toLowerCase()));

  // 计算基差得分区间的交易对数量，范围为0到10
  const calculateScoreRanges = () => { 
    const ranges = {}; 
    for (let i = 0; i <= 10; i += 0.5) { 
      ranges[i] = 0; 
    } 
    data.forEach(item => { 
      const score = Math.abs(parseFloat(item.score)); // 使用绝对值 
      for (let i = 0; i <= 10; i += 0.5) { 
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
    
    {/* 手动输入币种和计算按钮 */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
      <input
        type="text"
        placeholder="输入币种..."
        value={selectedSymbol}
        onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
        style={{ padding: '6px 10px', marginRight: 10, fontSize: 14, width: 200 }}
      />
      <button
        onClick={handleSymbolInput}
        style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: 4 }}
      >
        计算
      </button>
    </div>

    {/* 计算区域 */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <div>
        <label style={{ marginRight: 10 }}>本金 (n):</label>
        <input
          type="number"
          value={n}
          onChange={(e) => setN(e.target.value)}
          style={{ padding: '6px', marginRight: '10px' }}
        />

        <label style={{ marginRight: 10 }}>杠杆 (k):</label>
        <input
          type="number"
          value={k}
          onChange={(e) => setK(e.target.value)}
          style={{ padding: '6px', marginRight: '10px' }}
        />

        <label style={{ marginRight: 10 }}>现货滑点 (a):</label>
        <input
          type="number"
          step="0.01"
          value={a}
          onChange={(e) => setA(e.target.value)}
          style={{ padding: '6px', marginRight: '10px' }}
        />

        <label style={{ marginRight: 10 }}>合约滑点 (b):</label>
        <input
          type="number"
          step="0.01"
          value={b}
          onChange={(e) => setB(e.target.value)}
          style={{ padding: '6px', marginRight: '10px' }}
        />
      </div>
    </div>

    {/* 显示计算结果 */}
    {selectedSymbol && (
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p>最大仓位: {maxPosition ? maxPosition.toFixed(2) : 'N/A'}</p>
        <p>上限价: {upperPrice ? upperPrice.toFixed(2) : 'N/A'}</p>
        <p>下限价: {lowerPrice ? lowerPrice.toFixed(2) : 'N/A'}</p>
      </div>
    )}

    {/* 交易对数量和更新时间 */}
    <div style={{ textAlign: 'center', marginBottom: 15 }}>
      <span>交易对数量: {displayedData.length}</span>
      <span style={{ marginLeft: 20 }}>更新时间: {lastUpdated}</span>
    </div>

    {/* 交易对数据表格 */}
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
        {displayedData.map((row) => (
          <tr key={row.symbol} style={{ backgroundColor: Math.abs(row.score) > 10 ? '#ffcccc' : (parseFloat(row.score) > 1 ? '#fff4d6' : 'white'), cursor: 'pointer' }}>
            <td style={{ backgroundColor: highlightTokens.includes(row.symbol) ? '#d3f9d8' : 'transparent' }}>{row.symbol}</td>
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
  </main>
);
}
