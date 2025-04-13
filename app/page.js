'use client'; 
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // List of tokens to highlight
  const highlightTokens = [
    "1INCHUSDT", "AAVEUSDT", "ADAUSDT", "ADXUSDT", "ARUSDT", "ATOMUSDT", "AUCTIONUSDT", 
    "AVAXUSDT", "BCHUSDT", "BOMEUSDT", "BNBUSDT", "CAKEUSDT", "CFXUSDT", "CHZUSDT", 
    "COMPUSDT", "CRVUSDT", "DASHUSDT", "DEGOUSDT", "DEXEUSDT", "DOGEUSDT", "DOTUSDT", 
    "EGLDUSDT", "ELFUSDT", "ENJUSDT", "ENSUSDT", "ETCUSDT", "ETTUSDT", "FETUSDT", "FILUSDT", 
    "FISUSDT", "FLOWUSDT", "FORTHUSDT", "GALAUSDT", "GRTUSDT", "HARDUSDT", "HBARUSDT", 
    "IOTAUSDT", "IOTXUSDT", "JTOUSDT", "JUPUSDT", "KAVAUSDT", "KSMUSDT", "LINKUSDT", 
    "LPTUSDT", "LTCUSDT", "LUNAUSDT", "MANAUSDT", "MASKUSDT", "MBOXUSDT", "MKRUSDT", 
    "NEARUSDT", "NOTUSDT", "OMUSDT", "ONEUSDT", "OPUSDT", "PENGUUSDT", "PLYTHUSDT", 
    "POLUSDT", "RSUUSDT", "RUNEUSDT", "SANDUSDT", "SEIUSDT", "SHIBUSDT", "SKLUSDT", 
    "SNXUSDT", "SOLUSDT", "STXUSDT", "SUIUSDT", "SUPERUSDT", "THETAUSDT", "TIAUSDT", 
    "TIMUSDT", "TKOUSDT", "TONUSDT", "TRBUSDT", "TROYUSDT", "TRXUSDT", "TURBOUSDT", 
    "UNIUSDT", "UTKUSDT", "VETUSDT", "WIFUSDT", "XRPUSDT", "XTZUSDT", "YFIUSDT", "YGGUSDT", 
    "ZECUSDT", "ZILUSDT", "ZRXUSDT"
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

    // 将高亮币种的项排到最前面
    const highlightedData = combinedData.filter(item => highlightTokens.includes(item.symbol));
    const otherData = combinedData.filter(item => !highlightTokens.includes(item.symbol));

    setData([...highlightedData, ...otherData]);
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

  // 计算基差得分区间的交易对数量，范围为0到10
  const calculateScoreRanges = () => {
    const ranges = {};
    for (let i = 0; i <= 10; i += 0.5) {
      ranges[i] = 0;
    }

    data.forEach(item => {
      const score = Math.abs(parseFloat(item.score));  // 使用绝对值
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
                <span>{`[${range}, ${parseFloat(range) + 0.5}) ${scoreRanges[range]}`}</span>
              </div>
            );
          }
          return null;
        })}
      </div>

      <table border="1">
