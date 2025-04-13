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
    const maxPrice = Math.max(spotPrice, futurePrice);
    const maxPosition = (k * n) / maxPrice;

    let upperPrice, lowerPrice;
    if (parseFloat(row.score) > 0) { // 如果套利得分为正
      upperPrice = Math.max(spotPrice * (1 + (1 - a) / k), futurePrice * (1 - (1 - b) / k));
      lowerPrice = Math.min(spotPrice * (1 + (1 - a) / k), futurePrice * (1 - (1 - b) / k));
    } else { // 如果套利得分为负
      upperPrice = Math.max(spotPrice * (1 - (1 - a) / k), futurePrice * (1 + (1 - b) / k));
      lowerPrice = Math.min(spotPrice * (1 - (1 - a) / k), futurePrice * (1 + (1 - b) / k));
    }

    setMaxPosition(maxPosition);
    setUpperPrice(upperPrice);
    setLowerPrice(lowerPrice);
  };

  const handleSymbolInput = () => {
    // 根据输入的币种名称进行计算
    if (selectedSymbol) {
      const selectedData = data.find(item => item.symbol === selectedSymbol);
      if (selectedData) {
        calculatePosition(parseFloat(selectedData.spotPrice), parseFloat(selectedData.futurePrice));
      }
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
      <h1>币安现货期货套利筛选</h1>

      <div style={{ display: 'flex', marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="请输入币种名称" 
          value={selectedSymbol} 
          onChange={(e) => setSelectedSymbol(e.target.value)} 
          style={{ padding: 8, width: '300px', marginRight: '10px' }} 
        />
        <button 
          onClick={handleSymbolInput} 
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          计算
        </button>
      </div>

      <div>
        {displayedData.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>交易对</th>
                <th>现货价格</th>
                <th>合约价格</th>
                <th>基差率</th>
                <th>融资费率</th>
                <th>套利得分</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((row, index) => (
                <tr key={index}>
                  <td>{row.symbol}</td>
                  <td>{row.spotPrice}</td>
                  <td>{row.futurePrice}</td>
                  <td>{row.basisRate}%</td>
                  <td>{row.lastFundingRate}%</td>
                  <td>{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
