'use client'; 
import { useEffect, useState } from 'react';

export default function Home() { 
  const [data, setData] = useState([]); 
  const [symbols, setSymbols] = useState([]); 
  const [search, setSearch] = useState(''); 
  const [lastUpdated, setLastUpdated] = useState(null);
  const [period, setPeriod] = useState(8); // 交易周期，默认 8


  
  // 新增的参数和计算逻辑
  const [n, setN] = useState(300); // 本金默认300
  const [k, setK] = useState(5); // 杠杆默认5
  const [a, setA] = useState(0.4); // 现货滑点默认40%
  const [b, setB] = useState(0.08); // 合约滑点默认8%
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [maxPosition, setMaxPosition] = useState(null);
  const [upperPrice, setUpperPrice] = useState(null);
  const [lowerPrice, setLowerPrice] = useState(null);

  // 新增的现货价格和合约价格
  const [manualSpotPrice, setManualSpotPrice] = useState('');
  const [manualFuturePrice, setManualFuturePrice] = useState('');
  
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

  // 获取合约数据，并过滤1小时前的下架合约
  const fetchData = async () => { 
    if (symbols.length === 0) return; 
    const currentTime = Date.now(); 
    const oneHourAgo = currentTime -   60 * 60 * 1000; 

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
          const leverage = Number(k);
          const periodNum = Number(period);

         // 参考值
          const spotFeeRate = 0.0004;    // 现货手续费
          const futureFeeRate = 0.0008;  // 合约手续费
          const borrowRate = 0.01;       // 借贷利率
          const constantbasis=0.002;     // 常驻基差

          // 计算交易成本
          const tradingCost =(spotFeeRate + futureFeeRate) * leverage + borrowRate * leverage * periodNum / 2;
          const rawScore = (basisRate - predictedFundingRate-constantbasis) * leverage / 2 - tradingCost;
          // 只 toFixed 一次
          const score = rawScore.toFixed(4);



          // 检查合约是否下架，time 小于12小时之前的时间戳
          if (future.time && Number(future.time) < oneHourAgo) { 
            return null; 
          } 

          return { 
            symbol, 
            spotPrice, 
            futurePrice, 
            basisRate: basisRate.toFixed(2), 
            lastFundingRate: lastFundingRate.toFixed(4), 
            predictedFundingRate: predictedFundingRate.toFixed(4), 
            score, 
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
const calculatePosition = (spotPrice, futurePrice, score) => {
  if (isNaN(spotPrice) || isNaN(futurePrice)) {
    alert('价格数据无效');
    return;
  }

  const maxPrice = Math.max(spotPrice, futurePrice);
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
  // 1. 补全 USDT 后缀
  const symbolInput = selectedSymbol.toUpperCase();
  const fullSymbol = symbolInput.endsWith('USDT') ? symbolInput : symbolInput + 'USDT';

  console.log("Full Symbol:", fullSymbol);
  console.log("Data Array:", data);

  // 2. 用补全后的符号去 data 里找
  const selectedData = data.find(item => item.symbol === fullSymbol);
  console.log("Selected Data:", selectedData);

  if (selectedData) {
    const spotPrice = manualSpotPrice
      ? parseFloat(manualSpotPrice)
      : parseFloat(selectedData.spotPrice);
    const futurePrice = manualFuturePrice
      ? parseFloat(manualFuturePrice)
      : parseFloat(selectedData.futurePrice);

    // 3. 调用计算仓位的函数
    calculatePosition(spotPrice, futurePrice, parseFloat(selectedData.score));
  } else {
    alert(`币种 ${fullSymbol} 数据未找到`);
  }
};

  //辅助函数来判断有效数字
const getEffectiveDigits = (price) => {
  const num = parseFloat(price);
  if (isNaN(num)) return 0;
  const str = num.toExponential().replace('.', '').replace(/e[-+]\d+/, '');
  return str.replace(/^0+/, '').length;
};

// 手动更新数据的函数，等 fetchData 完成后再提示
const handleUpdateData = async () => {
  try {
    await fetchData();           // 等待数据更新完成
    alert('数据更新成功');       // 更新成功提示
  } catch (err) {
    console.error(err);
    alert('数据更新失败，请重试');
  }
};


// 对原始数据进行排序和筛选，得到最终用于展示的数据
const displayedData = [...data]
  .sort((a, b) => {
    // 判断 a 和 b 是否为异常值（套利得分的绝对值 > 30）
    const isAAbnormal = Math.abs(a.score) > 30;
    const isBAbnormal = Math.abs(b.score) > 30;

    // 异常值排到正常值后面
    if (isAAbnormal && !isBAbnormal) return 1;  // a 是异常，排后
    if (!isAAbnormal && isBAbnormal) return -1; // b 是异常，排后

    // 如果都为正常值或都为异常值，按套利得分的绝对值从高到低排序
    return Math.abs(b.score) - Math.abs(a.score);
  })
  .filter(item =>
    // 根据用户输入关键词 search 进行币种代码的模糊匹配
    item.symbol.toLowerCase().includes(search.toLowerCase())
  );

// 从排序后的数据中筛出高亮币种（一般是你关注的重点币）
const highlightedData = displayedData.filter(item =>
  highlightTokens.includes(item.symbol)
);

// 其余为非高亮币种，单独作为右侧表格显示
const nonHighlightedData = displayedData.filter(item =>
  !highlightTokens.includes(item.symbol)
);

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

    {/* 搜索框 */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 15 }}>
      <input
        type="text"
        placeholder="搜索币种..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '6px 10px', marginRight: 10, fontSize: 14, width: 200 }}
      />
    </div>

    {/* 计算区域 */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ marginRight: 10 }}>本金 (n):</label>
          <input
            type="number"
            value={n}
            onChange={(e) => setN(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>
        <div>
          <label style={{ marginRight: 10 }}>杠杆 (k):</label>
          <input
            type="number"
            value={k}
            onChange={(e) => setK(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>

        <div>
          <label style={{ marginRight: 10 }}>现货滑点 (a):</label>
          <input
            type="number"
            step="0.01"
            value={a}
            onChange={(e) => setA(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>
        <div>
          <label style={{ marginRight: 10 }}>合约滑点 (b):</label>
          <input
            type="number"
            step="0.01"
            value={b}
            onChange={(e) => setB(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>

        {/* 新增现货价格输入框 */}
        <div>
          <label style={{ marginRight: 10 }}>现货价格 (Spot Price):</label>
          <input
            type="number"
            value={manualSpotPrice}
            onChange={(e) => setManualSpotPrice(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>

        {/* 新增合约价格输入框 */}
        <div>
          <label style={{ marginRight: 10 }}>合约价格 (Future Price):</label>
          <input
            type="number"
            value={manualFuturePrice}
            onChange={(e) => setManualFuturePrice(e.target.value)}
            style={{ padding: '6px', width: '100%' }}
          />
        </div>
            <div>
              <label style={{ marginRight: 10 }}>交易周期 (Hours):</label>
              <input
                type="number"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                style={{ padding: '6px', width: '100%' }}
            />
          </div>
      </div>
    </div>


    {/* 币种输入框和计算按钮 */}
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

    {/* 显示计算结果 */}
    {selectedSymbol && (
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p>最大仓位: {maxPosition ? maxPosition.toFixed(2) : 'N/A'}</p>
        <p>上限价: {upperPrice ? upperPrice.toFixed(6) : 'N/A'}</p>
        <p>下限价: {lowerPrice ? lowerPrice.toFixed(6) : 'N/A'}</p>
      </div>
    )}

    {/* 交易对数量和更新时间 */}
    <div style={{ textAlign: 'center', marginBottom: 15 }}>
      <span>交易对数量: {displayedData.length}</span>
      <span style={{ marginLeft: 20 }}>更新时间: {lastUpdated}</span>

      {/* 数据更新按钮 */}
      <button
        onClick={handleUpdateData}
        style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4, marginLeft: 10 }}
      >
        数据更新
      </button>
    </div>

    {/* 交易对数据表格 */}
    {/* 页面布局为两个表格并排，用 Flex 布局实现左右结构 */}
<div style={{ display: 'flex', gap: '20px' }}>
  
  {/* 高亮币种表格 */}
  <div style={{ flex: 1 }}>
    <h3>可借贷币种</h3>
    <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead style={{ backgroundColor: '#f2f2f2' }}>
        <tr>
          <th>币种</th>
          <th>现货价</th>
          <th>合约价</th>
          <th>基差率%</th>
          <th>预期资金费率%</th> {/* 删除了“上次资金费率” */}
          <th>无风险利率</th>
        </tr>
      </thead>
      <tbody>
        {highlightedData.map((row) => (
       <tr
  key={row.symbol}
  style={{
    backgroundColor:
      Math.abs(row.score) > 10
        ? '#ffcccc'
        : Math.abs(row.score) > 1
        ? '#fff4d6'
        : 'white',
    cursor: 'pointer',
  }}
>
  {/* 币种名单元格：如果是高亮币种，加淡绿色背景 */}
  <td style={{ backgroundColor: '#d3f9d8' }}>{row.symbol}</td>

  {/* 现货价格：有效数字 ≤ 3 显示灰色 */}
  <td style={{ backgroundColor: getEffectiveDigits(row.spotPrice) <= 3 ? '#e0e0e0' : 'white' }}>
    {row.spotPrice}
  </td>

  {/* 合约价格：有效数字 ≤ 3 显示灰色 */}
  <td style={{ backgroundColor: getEffectiveDigits(row.futurePrice) <= 3 ? '#e0e0e0' : 'white' }}>
    {row.futurePrice}
  </td>

  <td>{row.basisRate}</td>

  {/* 资金费率绝对值 ≥ 1 显示浅蓝色 */}
  <td style={{ backgroundColor: Math.abs(parseFloat(row.predictedFundingRate)) >= 1 ? '#d6ecff' : 'white' }}>
    {row.predictedFundingRate}
  </td>

  {/* 无风险利率 */}
  <td>{row.score}</td>
</tr>


        ))}
      </tbody>
    </table>
  </div>

  {/* 非高亮币种表格 */}
  <div style={{ flex: 1 }}>
    <h3>其他币种</h3>
    <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead style={{ backgroundColor: '#f2f2f2' }}>
        <tr>
          <th>币种</th>
          <th>现货价</th>
          <th>合约价</th>
          <th>基差率%</th>
          <th>预期资金费率%</th> {/* 同样删掉“上次资金费率” */}
          <th>无风险利率</th>
        </tr>
      </thead>
      <tbody>
        {nonHighlightedData.map((row) => (
                  <tr
  key={row.symbol}
  style={{
    backgroundColor:
      Math.abs(row.score) > 10
        ? '#ffcccc'
        : Math.abs(row.score) > 1
        ? '#fff4d6'
        : 'white',
    cursor: 'pointer',
  }}
>
  {/* 币种 */}
  <td>{row.symbol}</td>

  {/* 现货价格：有效数字 ≤ 3 显示灰色 */}
  <td
    style={{
      backgroundColor: getEffectiveDigits(row.spotPrice) <= 3 ? '#e0e0e0' : 'white',
    }}
  >
    {row.spotPrice}
  </td>

  {/* 合约价格：有效数字 ≤ 3 显示灰色 */}
  <td
    style={{
      backgroundColor: getEffectiveDigits(row.futurePrice) <= 3 ? '#e0e0e0' : 'white',
    }}
  >
    {row.futurePrice}
  </td>

  <td>{row.basisRate}</td>

  {/* 资金费率 ≥ 1 标蓝色 */}
  <td
    style={{
      backgroundColor: Math.abs(parseFloat(row.predictedFundingRate)) >= 1 ? '#d6ecff' : 'white',
    }}
  >
    {row.predictedFundingRate}
  </td>

  {/* 无风险利率 */}
  <td>{row.score}</td>
</tr>


        ))}
      </tbody>
    </table>
  </div>
</div>
</main>
);}
