import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cog6ToothIcon, PlusIcon, TrashIcon, BoltIcon, ChartBarIcon, CalculatorIcon, StarIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { executeFill, executeQuickSell, executeFillWithPrice, executeCancelAll } from '../content/fill-logic';
import {
  collectOrdersFromTable,
  detectAirdrops,
  calculateStats,
  calculateLoss,
  calculateTodayScore
} from '../content/score-calculator';

const translations = {
  zh: {
    title: '币安Alpha助手',
    lossCalcTitle: '今日损耗计算',
    offsetLabel: '价格偏移 (Ticks)',
    offsetDesc: '计算限价: 当前价 ± (步长 × {offset})',
    qtyLabel: '数量预设',
    addQtyPlaceholder: '添加数量...',
    autoFill: '自动填充',
    autoSubmit: '自动买入',
    autoSubmitDesc: '警告: 填充后立即点击买入按钮',
    executing: '执行中...',
    success: '成功!',
    errorApi: '错误: Chrome API 不可用',
    errorTab: '错误: 无活动标签页',
    errorRefresh: '错误: 请刷新页面?',
    failed: '失败',
    reverseOrderNotFound: '未找到"反向订单"选项，请刷新页面',
    reverseOrderAutoCheckFailed: '自动勾选"反向订单"失败，请手动勾选后重试',
    reverseOrderAutoUncheckFailed: '自动取消"反向订单"失败，请手动取消后重试',
    buyTabNotFound: '未找到"买入"标签页，请刷新页面',
    sellInputNotFound: '未找到卖出价格输入框',
    version: 'v1.1.0',
    // Tabs
    tabFill: '刷分',
    tabScore: '今日统计',
    // Score tab
    statsTitle: '今日交易统计',
    buyTotal: '买入总额',
    sellTotal: '卖出总额',
    txUnit: '笔',
    lossTitle: '今日损耗',
    scoreTitle: '今日得分',
    scoreFormula: '总买入×4: 2U=1分, 4U=2分, 8U=3分...',
    formula: '(买入 - 卖出 + 空投) × 2',
    calcScore: '计算刷分',
    calculating: '计算中...',
    recalculate: '重新计算',
    noOrders: '未找到今日订单',
    tableNotFound: '未找到订单历史表格',
    airdropDeducted: '空投已扣除',
    // Target score
    targetScoreLabel: '刷分目标',
    targetScoreDesc: '目标金额: {amount} USDT',
    autoPreset: '自动',
    targetReached: '已达标',
    // Quick sell
    quickSell: '快速卖出',
    quickSellExecuting: '卖出中...',
    quickSellSuccess: '卖出成功!',
    sellTabNotFound: '未找到卖出标签页',
    priceNotFound: '未找到当前价格',
    amountDivNotFound: '未找到持仓数量',
    sellButtonNotFound: '未找到卖出按钮',
    // Cancel all
    cancelAll: '全部取消',
    cancelAllExecuting: '取消中...',
    cancelAllSuccess: '已取消!',
    openOrdersTabNotFound: '未找到"当前委托"标签页',
    cancelAllBtnNotFound: '未找到"全部取消"按钮'
  },
  en: {
    title: 'Binance Alpha Assistant',
    lossCalcTitle: 'Daily Loss Calculator',
    offsetLabel: 'Price Offset (Ticks)',
    offsetDesc: 'Calculates limit price: Current ± (Step × {offset})',
    qtyLabel: 'Quantity Preset',
    addQtyPlaceholder: 'Add qty...',
    autoFill: 'AUTO FILL',
    autoSubmit: 'Auto Buy',
    autoSubmitDesc: 'Warning: Clicks Buy immediately',
    executing: 'Executing...',
    success: 'Success!',
    errorApi: 'Error: Chrome API not available',
    errorTab: 'Error: No active tab',
    errorRefresh: 'Error: Refresh page?',
    failed: 'Failed',
    reverseOrderNotFound: '"Reverse Order" option not found, please refresh',
    reverseOrderAutoCheckFailed: 'Failed to auto-check "Reverse Order", please check manually',
    reverseOrderAutoUncheckFailed: 'Failed to auto-uncheck "Reverse Order", please uncheck manually',
    buyTabNotFound: '"Buy" tab not found, please refresh',
    sellInputNotFound: 'Sell price input not found',
    version: 'v1.1.0',
    // Tabs
    tabFill: 'Score',
    tabScore: 'Today Stats',
    // Score tab
    statsTitle: 'Today\'s Trading Stats',
    buyTotal: 'Buy Total',
    sellTotal: 'Sell Total',
    txUnit: 'tx',
    lossTitle: 'Today\'s Loss',
    scoreTitle: 'Today\'s Score',
    scoreFormula: 'Total buy×4: 2U=1pt, 4U=2pt, 8U=3pt...',
    formula: '(Buy - Sell + Airdrop) × 2',
    calcScore: 'Calculate Score',
    calculating: 'Calculating...',
    recalculate: 'Recalculate',
    noOrders: 'No orders found today',
    tableNotFound: 'Order history table not found',
    airdropDeducted: 'Airdrop deducted',
    // Target score
    targetScoreLabel: 'Score Target',
    targetScoreDesc: 'Target amount: {amount} USDT',
    autoPreset: 'Auto',
    targetReached: 'Reached',
    // Quick sell
    quickSell: 'Quick Sell',
    quickSellExecuting: 'Selling...',
    quickSellSuccess: 'Sold!',
    sellTabNotFound: 'Sell tab not found',
    priceNotFound: 'Price not found',
    amountDivNotFound: 'Holdings not found',
    sellButtonNotFound: 'Sell button not found',
    // Cancel all
    cancelAll: 'Cancel All',
    cancelAllExecuting: 'Cancelling...',
    cancelAllSuccess: 'Cancelled!',
    openOrdersTabNotFound: 'Open Orders tab not found',
    cancelAllBtnNotFound: 'Cancel All button not found'
  }
};

const DEFAULT_SETTINGS = {
  offsetTicks: 3,
  selectedQuantity: 1024,
  presets: [
    { id: '1', value: 512 },
    { id: '2', value: 1024 },
    { id: '3', value: 1024.1 },
  ],
  language: 'zh',
  autoSubmit: false,
  targetScore: 16
};

export { translations };

// 将数字格式化为 k 格式（如 16418 -> 16.42k）
const formatToK = (num) => {
  if (num === null || isNaN(num)) return '--';
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'k';
  }
  return num.toFixed(2);
};

const App = ({ currentLanguage }) => {
  const [offset, setOffset] = useState(DEFAULT_SETTINGS.offsetTicks);
  const [quantity, setQuantity] = useState(DEFAULT_SETTINGS.selectedQuantity);
  const [presets, setPresets] = useState(DEFAULT_SETTINGS.presets);
  const [language, setLanguage] = useState(currentLanguage || DEFAULT_SETTINGS.language);
  const [autoSubmit, setAutoSubmit] = useState(DEFAULT_SETTINGS.autoSubmit || false);
  const [newPresetVal, setNewPresetVal] = useState('');
  const [status, setStatus] = useState('');
  const [quickSellStatus, setQuickSellStatus] = useState('');
  const [cancelAllStatus, setCancelAllStatus] = useState('');

  // Target score related state
  const [targetScore, setTargetScore] = useState(DEFAULT_SETTINGS.targetScore);
  const [autoAmount, setAutoAmount] = useState(null);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState('fill'); // 'fill' | 'score'

  // Score tab state
  const [scoreStatus, setScoreStatus] = useState('idle'); // idle | loading | done | error
  const [orders, setOrders] = useState([]);
  const [airdrops, setAirdrops] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Current price state for real-time display
  const [currentPrice, setCurrentPrice] = useState(null);
  // 买单最大委托量信息 { price, quantity }
  const [maxBidOrder, setMaxBidOrder] = useState(null);
  // 卖单最大委托量信息 { price, quantity }
  const [maxAskOrder, setMaxAskOrder] = useState(null);

  // Helper for translations
  const t = (key) => translations[language][key];

  // Load settings from storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(['tradeAssistSettings'], (result) => {
        if (result.tradeAssistSettings) {
          const s = result.tradeAssistSettings;
          setOffset(s.offsetTicks ?? DEFAULT_SETTINGS.offsetTicks);
          setQuantity(s.selectedQuantity ?? DEFAULT_SETTINGS.selectedQuantity);
          setPresets(s.presets ?? DEFAULT_SETTINGS.presets);
          setLanguage(s.language ?? DEFAULT_SETTINGS.language);
          setAutoSubmit(s.autoSubmit ?? DEFAULT_SETTINGS.autoSubmit ?? false);
          setTargetScore(s.targetScore ?? DEFAULT_SETTINGS.targetScore);
        }
      });
    }
  }, []);

  // Save settings helper
  const saveSettings = useCallback((newSettings) => {
    const currentSettings = {
      offsetTicks: newSettings.offsetTicks ?? offset,
      selectedQuantity: newSettings.selectedQuantity ?? quantity,
      presets: newSettings.presets ?? presets,
      language: newSettings.language ?? language,
      autoSubmit: newSettings.autoSubmit ?? autoSubmit,
      targetScore: newSettings.targetScore ?? targetScore
    };

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ tradeAssistSettings: currentSettings });
    }
  }, [offset, quantity, presets, language, autoSubmit, targetScore]);

  // 从页面获取当前价格
  const fetchCurrentPrice = useCallback(() => {
    try {
      const container = document.querySelector('.orderlist-container');
      if (!container) return;

      const priceEl = container.querySelector('.text-\\[20px\\]');
      if (!priceEl) return;

      const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
      const price = parseFloat(priceText);

      if (!isNaN(price) && price > 0) {
        setCurrentPrice(price);
      }
    } catch (e) {
      console.error('[TradeAssist] 获取价格失败:', e);
    }
  }, []);

  // 实时刷新价格（200ms）
  useEffect(() => {
    fetchCurrentPrice();
    const interval = setInterval(fetchCurrentPrice, 200);
    return () => clearInterval(interval);
  }, [fetchCurrentPrice]);

  // 计算预估买入数量
  const estimatedBuyQuantity = useMemo(() => {
    if (currentPrice === null || currentPrice === 0 || !quantity) return null;
    return quantity / currentPrice;
  }, [currentPrice, quantity]);

  // 解析数量字符串（如 "116.89K" -> 116890）
  const parseQuantityText = useCallback((text) => {
    if (!text) return 0;
    const cleanText = text.trim().toUpperCase();
    const num = parseFloat(cleanText.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0;
    if (cleanText.includes('K')) return num * 1000;
    if (cleanText.includes('M')) return num * 1000000;
    return num;
  }, []);

  // 获取订单簿中买单和卖单各自的最大委托量
  const fetchMaxOrder = useCallback(() => {
    try {
      let maxBid = { price: 0, quantity: 0 };
      let maxAsk = { price: 0, quantity: 0 };

      // 解析卖单 (ask) - 找出卖单最大
      const askList = document.querySelector('.orderbook-ask');
      if (askList) {
        const askRows = askList.querySelectorAll('.orderbook-progress');
        askRows.forEach(row => {
          const priceEl = row.querySelector('.ask-light.emit-price span');
          const qtyEl = row.querySelector('.text.emit-price span');
          if (priceEl && qtyEl) {
            const price = parseFloat(priceEl.innerText);
            const qty = parseQuantityText(qtyEl.innerText);
            if (qty > maxAsk.quantity) {
              maxAsk = { price, quantity: qty };
            }
          }
        });
      }

      // 解析买单 (bid) - 找出买单最大
      const bidList = document.querySelector('.orderbook-bid');
      if (bidList) {
        const bidRows = bidList.querySelectorAll('.orderbook-progress');
        bidRows.forEach(row => {
          const priceEl = row.querySelector('.bid-light.emit-price span');
          const qtyEl = row.querySelector('.text.emit-price span');
          if (priceEl && qtyEl) {
            const price = parseFloat(priceEl.innerText);
            const qty = parseQuantityText(qtyEl.innerText);
            if (qty > maxBid.quantity) {
              maxBid = { price, quantity: qty };
            }
          }
        });
      }

      // 分别更新买单和卖单的最大委托
      if (maxBid.quantity > 0) {
        setMaxBidOrder(maxBid);
      }
      if (maxAsk.quantity > 0) {
        setMaxAskOrder(maxAsk);
      }
    } catch (e) {
      console.error('[TradeAssist] 获取最大委托量失败:', e);
    }
  }, [parseQuantityText]);

  // 实时刷新最大委托量（200ms）
  useEffect(() => {
    fetchMaxOrder();
    const interval = setInterval(fetchMaxOrder, 200);
    return () => clearInterval(interval);
  }, [fetchMaxOrder]);

  // 同步外部语言变化
  useEffect(() => {
    if (currentLanguage && currentLanguage !== language) {
      setLanguage(currentLanguage);
      saveSettings({ language: currentLanguage });
    }
  }, [currentLanguage]);

  const handleAddPreset = () => {
    const val = parseFloat(newPresetVal);
    if (!isNaN(val) && val > 0) {
      const newPresets = [...presets, { id: Date.now().toString(), value: val }];
      setPresets(newPresets);
      setNewPresetVal('');
      saveSettings({ presets: newPresets });
    }
  };

  const handleDeletePreset = (id) => {
    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    if (newPresets.length > 0 && quantity === presets.find(p => p.id === id)?.value) {
      setQuantity(newPresets[0].value);
    }
    saveSettings({ presets: newPresets });
  };

  const handleQuantitySelect = (val) => {
    setQuantity(val);
    setIsAutoMode(false);
    saveSettings({ selectedQuantity: val });
  };

  const handleOffsetChange = (e) => {
    const val = parseInt(e.target.value);
    setOffset(val);
    saveSettings({ offsetTicks: val });
  };

  const handleAutoSubmitChange = (e) => {
    const val = e.target.checked;
    setAutoSubmit(val);
    saveSettings({ autoSubmit: val });
  };

  // 计算目标金额 = 2^分数
  const calculateTargetAmount = (score) => Math.pow(2, score);

  // 计算剩余需刷金额
  const calculateRemainingAmount = useCallback((buyTotal) => {
    const targetAmount = calculateTargetAmount(targetScore);
    const adjustedAmount = buyTotal * 4;
    const remaining = targetAmount - adjustedAmount;
    if (remaining <= 0) return 0;

    // 向上取整保留两位小数
    const baseAmount = Math.ceil((remaining / 4) * 100) / 100;

    // 添加 0.00 ~ 1.00 的随机超额（保留两位小数），避免系统检测
    const randomExtra = Math.floor(Math.random() * 101) / 100;

    return Math.round((baseAmount + randomExtra) * 100) / 100;
  }, [targetScore]);

  // 自动刷新计算逻辑
  const refreshAutoAmount = useCallback(async () => {
    try {
      let orders = collectOrdersFromTable();

      // 如果表格不存在，尝试切换到历史委托标签
      if (orders.length === 0) {
        const tbody = document.querySelector('#trd-order-history tbody');
        if (!tbody) {
          const historyTab = document.querySelector('#bn-tab-orderHistory') ||
                            document.querySelector('[data-tab-key="orderHistory"]');
          if (historyTab) {
            historyTab.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            orders = collectOrdersFromTable();
          }
        }
      }

      const stats = calculateStats(orders);
      const remaining = calculateRemainingAmount(stats.buyTotal);
      setAutoAmount(remaining);
    } catch (err) {
      console.error('[AutoAmount] Error:', err);
      setAutoAmount(null);
    }
  }, [calculateRemainingAmount]);

  // 3秒定时器 - 进入fill tab时启用
  useEffect(() => {
    let intervalId = null;

    if (activeTab === 'fill') {
      refreshAutoAmount();
      intervalId = setInterval(refreshAutoAmount, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab, refreshAutoAmount]);

  // 目标分数变更
  const handleTargetScoreChange = (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= 30) {
      setTargetScore(val);
      saveSettings({ targetScore: val });
    }
  };

  // 选择自动预设
  const handleAutoPresetSelect = () => {
    if (autoAmount !== null && autoAmount > 0) {
      setQuantity(autoAmount);
      setIsAutoMode(true);
      saveSettings({ selectedQuantity: autoAmount });
    }
  };

  // 直接调用填充逻辑（content script 环境）
  const handleExecute = async () => {
    setStatus(t('executing'));

    try {
      const result = await executeFill(offset, quantity, autoSubmit);

      if (result.success) {
        setStatus(t('success'));
        setTimeout(() => setStatus(''), 2000);
      } else {
        // 映射错误码到翻译消息
        const errorCodeMap = {
          'REVERSE_ORDER_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_CHECKBOX_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_AUTO_CHECK_FAILED': 'reverseOrderAutoCheckFailed',
          'BUY_TAB_NOT_FOUND': 'buyTabNotFound',
          'SELL_INPUT_NOT_FOUND': 'sellInputNotFound'
        };
        const errorKey = result.errorCode && errorCodeMap[result.errorCode];
        setStatus(errorKey ? t(errorKey) : (result.message || t('failed')));
      }
    } catch (e) {
      setStatus(t('failed'));
      console.error(e);
    }
  };

  // 快速卖出处理函数
  const handleQuickSell = async () => {
    setQuickSellStatus(t('quickSellExecuting'));

    try {
      const result = await executeQuickSell();

      if (result.success) {
        setQuickSellStatus(t('quickSellSuccess'));
        setTimeout(() => setQuickSellStatus(''), 2000);
      } else {
        // 映射错误码到翻译消息
        const errorCodeMap = {
          'REVERSE_ORDER_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_CHECKBOX_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_AUTO_UNCHECK_FAILED': 'reverseOrderAutoUncheckFailed',
          'SELL_TAB_NOT_FOUND': 'sellTabNotFound',
          'PRICE_NOT_FOUND': 'priceNotFound',
          'AMOUNT_DIV_NOT_FOUND': 'amountDivNotFound',
          'SELL_BUTTON_NOT_FOUND': 'sellButtonNotFound'
        };
        const errorKey = result.errorCode && errorCodeMap[result.errorCode];
        setQuickSellStatus(errorKey ? t(errorKey) : (result.message || t('failed')));
      }
    } catch (e) {
      setQuickSellStatus(t('failed'));
      console.error(e);
    }
  };

  // 全部取消处理函数
  const handleCancelAll = async () => {
    setCancelAllStatus(t('cancelAllExecuting'));

    try {
      const result = await executeCancelAll();

      if (result.success) {
        setCancelAllStatus(t('cancelAllSuccess'));
        setTimeout(() => setCancelAllStatus(''), 2000);
      } else {
        const errorCodeMap = {
          'OPEN_ORDERS_TAB_NOT_FOUND': 'openOrdersTabNotFound',
          'CANCEL_ALL_BTN_NOT_FOUND': 'cancelAllBtnNotFound'
        };
        const errorKey = result.errorCode && errorCodeMap[result.errorCode];
        setCancelAllStatus(errorKey ? t(errorKey) : (result.message || t('failed')));
      }
    } catch (e) {
      setCancelAllStatus(t('failed'));
      console.error(e);
    }
  };

  // 根据最大委托量价格自动填充（使用预设数量）
  // side: 'bid' 使用买单最大, 'ask' 使用卖单最大
  const handleFillByMaxOrder = async (side) => {
    const orderInfo = side === 'bid' ? maxBidOrder : maxAskOrder;
    if (!orderInfo) {
      setStatus(language === 'zh' ? '未找到委托数据' : 'No order data');
      return;
    }

    // 使用最大委托量的价格，但数量用预设的 quantity
    setStatus(t('executing'));
    try {
      const result = await executeFillWithPrice(orderInfo.price, offset, quantity, autoSubmit);
      if (result.success) {
        setStatus(t('success'));
        setTimeout(() => setStatus(''), 2000);
      } else {
        const errorCodeMap = {
          'REVERSE_ORDER_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_CHECKBOX_NOT_FOUND': 'reverseOrderNotFound',
          'REVERSE_ORDER_AUTO_CHECK_FAILED': 'reverseOrderAutoCheckFailed',
          'BUY_TAB_NOT_FOUND': 'buyTabNotFound',
          'SELL_INPUT_NOT_FOUND': 'sellInputNotFound'
        };
        const errorKey = result.errorCode && errorCodeMap[result.errorCode];
        setStatus(errorKey ? t(errorKey) : (result.message || t('failed')));
      }
    } catch (e) {
      setStatus(t('failed'));
      console.error(e);
    }
  };

  // 计算统计数据（刷分 tab）
  const stats = useMemo(() => {
    if (orders.length === 0) return { buyTotal: 0, sellTotal: 0, buyCount: 0, sellCount: 0 };
    return calculateStats(orders);
  }, [orders]);

  // 计算空投总额
  const airdropAmount = useMemo(() => {
    return airdrops.reduce((sum, a) => sum + a.amount, 0);
  }, [airdrops]);

  // 计算损耗
  const loss = useMemo(() => {
    if (orders.length === 0) return 0;
    return calculateLoss(stats, airdropAmount);
  }, [stats, airdropAmount, orders.length]);

  // 计算今日得分
  const scoreData = useMemo(() => {
    if (orders.length === 0) return { score: 0, adjustedAmount: 0 };
    return calculateTodayScore(orders);
  }, [orders]);

  // 开始计算刷分
  const handleCalculateScore = async () => {
    setScoreStatus('loading');
    setErrorMsg('');
    setOrders([]);
    setAirdrops([]);

    try {
      // 第一次尝试获取数据
      let result = collectOrdersFromTable();

      // 如果表格不存在，尝试切换到历史委托标签
      if (result.length === 0) {
        const tbody = document.querySelector('#trd-order-history tbody');
        if (!tbody) {
          // 尝试点击历史委托标签
          const historyTab = document.querySelector('#bn-tab-orderHistory') ||
                            document.querySelector('[data-tab-key="orderHistory"]');
          if (historyTab) {
            historyTab.click();
            // 等待 DOM 更新
            await new Promise(resolve => setTimeout(resolve, 500));
            // 重新尝试获取数据
            result = collectOrdersFromTable();
          }
        }
      }

      // 再次检查结果
      if (result.length === 0) {
        const tbody = document.querySelector('#trd-order-history tbody');
        if (!tbody) {
          setErrorMsg(t('tableNotFound'));
          setScoreStatus('error');
          return;
        }
        setScoreStatus('done');
        return;
      }

      setOrders(result);

      // 检测空投
      const detectedAirdrops = detectAirdrops(result);
      setAirdrops(detectedAirdrops);

      setScoreStatus('done');
    } catch (err) {
      console.error('[ScoreCalculator]', err);
      setErrorMsg(err.message || t('failed'));
      setScoreStatus('error');
    }
  };

  return (
    <div className="flex flex-col bg-gray-900 text-gray-100 font-sans p-2 h-full">
      {/* Tabs */}
      <div className="flex mb-2 bg-gray-800 rounded-lg p-0.5 shrink-0">
        <button
          onClick={() => setActiveTab('fill')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'fill'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {t('tabFill')}
        </button>
        <button
          onClick={() => setActiveTab('score')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'score'
              ? 'bg-blue-600 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {t('tabScore')}
        </button>
      </div>

      {/* Fill Tab Content */}
      {activeTab === 'fill' && (
      <div className="flex-1 flex flex-col gap-3 min-h-0 pt-1">

        {/* Offset & Target Score Section - Balanced Row */}
        <div className="flex gap-2 shrink-0">
          {/* Tick Offset */}
          <div className="flex-1 space-y-1">
            <label className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
              <Cog6ToothIcon className="w-3 h-3" />
              <span>{language === 'zh' ? '偏移 (Ticks)' : 'Offset'}</span>
            </label>
            <div className="flex items-center justify-between bg-gray-800 px-2 py-1.5 rounded-md border border-gray-700 h-9">
              <span className="text-gray-500 text-xs font-mono">±</span>
              <input
                type="number"
                min="1"
                max="20"
                value={offset}
                onChange={handleOffsetChange}
                className="w-full bg-transparent border-none text-center font-mono text-sm font-bold text-blue-400 focus:ring-0 p-0"
              />
            </div>
          </div>

          {/* Target Score */}
          <div className="flex-[1.5] space-y-1">
            <label className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
              <StarIcon className="w-3 h-3" />
              <span>{t('targetScoreLabel')}</span>
            </label>
            <div className="flex items-center bg-gray-800 px-2 py-1.5 rounded-md border border-gray-700 h-9">
              <input
                type="number"
                min="1"
                max="30"
                value={targetScore}
                onChange={handleTargetScoreChange}
                className="w-8 bg-transparent border-none text-center font-mono text-sm font-bold text-purple-400 focus:ring-0 p-0"
              />
              <span className="text-gray-500 text-xs mx-1">{language === 'zh' ? '分' : 'pt'}</span>
              <span className="text-gray-600 text-xs mr-1">=</span>
              <span className="font-mono text-xs text-purple-300 flex-1 text-right">{calculateTargetAmount(targetScore).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Quantity Section */}
        <div className="space-y-1 shrink-0">
          <label className="text-[10px] font-medium text-gray-400">{t('qtyLabel')}</label>
          <div className="grid grid-cols-4 gap-2">
            {/* Auto preset button */}
            <button
              onClick={handleAutoPresetSelect}
              disabled={autoAmount === null}
              className={`relative px-1 py-1 rounded-md text-xs font-mono font-semibold transition-all border
                ${isAutoMode
                  ? 'bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-900/50 cursor-pointer'
                  : autoAmount === null
                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-900/30 border-purple-700 text-purple-300 hover:bg-purple-800/50 hover:border-purple-600 cursor-pointer'
                }`}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-[9px] opacity-70 mb-0.5">{t('autoPreset')}</span>
                <span className="font-bold leading-none">
                  {autoAmount === null
                    ? '...'
                    : autoAmount === 0
                      ? t('targetReached')
                      : autoAmount.toFixed(2)
                  }
                </span>
              </div>
            </button>

            {/* Preset buttons */}
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleQuantitySelect(preset.value)}
                className={`relative group px-1 py-1 rounded-md text-xs font-mono font-semibold transition-all border cursor-pointer flex items-center justify-center h-10
                  ${quantity === preset.value && !isAutoMode
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-900/50'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-600'
                  }`}
              >
                {preset.value}
                <div
                  onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 bg-red-500 rounded-full items-center justify-center cursor-pointer hover:bg-red-400 z-10 shadow-sm"
                >
                  <TrashIcon className="w-2.5 h-2.5 text-white" />
                </div>
              </button>
            ))}
          </div>

          {/* Add Preset */}
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={newPresetVal}
                onChange={(e) => setNewPresetVal(e.target.value)}
                placeholder={t('addQtyPlaceholder')}
                className="w-full bg-gray-800 border border-gray-700 rounded-md pl-2 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
            <button
              onClick={handleAddPreset}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 border border-gray-600 cursor-pointer transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auto Submit Toggle & Buy Qty Display */}
        <div className="flex gap-2 shrink-0">
          <div className="flex-[0.8] bg-red-900/10 border border-red-900/30 rounded-md px-3 py-2 flex items-center transition-colors hover:bg-red-900/20">
            <label className="flex items-center space-x-3 cursor-pointer w-full">
              <input
                type="checkbox"
                checked={autoSubmit}
                onChange={handleAutoSubmitChange}
                className="form-checkbox h-4 w-4 text-red-500 rounded border-gray-600 bg-gray-700 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-red-400 select-none">{t('autoSubmit')}</span>
            </label>
          </div>
          <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-md border border-gray-700 px-3">
             <span className="text-base font-bold font-mono text-green-400 tracking-wide">
              {formatToK(estimatedBuyQuantity)}
            </span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-auto pt-2 border-t border-gray-800 space-y-3">
          
          <div className="grid grid-cols-2 gap-3">
            {/* 自动填充按钮 */}
            <button
              onClick={handleExecute}
              className={`flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer text-sm
                ${autoSubmit
                  ? 'bg-gradient-to-br from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-900/20'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20'
                }`}
            >
              <BoltIcon className="w-4 h-4" />
              {t('autoFill')}
            </button>

            {/* 快速卖出按钮 */}
            <button
              onClick={handleQuickSell}
              className="flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer bg-gradient-to-br from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-orange-900/20 text-sm"
            >
              <BoltIcon className="w-4 h-4" />
              {t('quickSell')}
            </button>
          </div>

          {/* 全部取消按钮 */}
          <button
            onClick={handleCancelAll}
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-2 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 border border-gray-500 text-sm"
          >
            {t('cancelAll')}
          </button>

          {(status || quickSellStatus || cancelAllStatus) && (
            <div className="text-center text-[10px] font-mono font-bold truncate h-4 flex justify-center items-center gap-3">
              {status && <span className={status === t('success') ? 'text-green-400' : 'text-yellow-400'}>{status}</span>}
              {quickSellStatus && <span className={quickSellStatus === t('quickSellSuccess') ? 'text-green-400' : 'text-yellow-400'}>{quickSellStatus}</span>}
              {cancelAllStatus && <span className={cancelAllStatus === t('cancelAllSuccess') ? 'text-green-400' : 'text-yellow-400'}>{cancelAllStatus}</span>}
            </div>
          )}

          {/* Max Order Info - 买最大和卖最大并排显示 */}
          {/* 当前价格 */}
          {currentPrice && (
            <div className="text-center text-sm mb-1">
              <span className="text-gray-400">{language === 'zh' ? '当前价格' : 'Price'}: </span>
              <span className="text-white font-mono font-bold">{currentPrice.toFixed(8)}</span>
            </div>
          )}

          {/* 当前价格距买卖最大价差 */}
          {currentPrice && maxBidOrder && maxAskOrder && (
            <div className="flex justify-center gap-4 text-[10px] text-gray-400 mb-1">
              <span>
                {language === 'zh' ? '距买最大' : 'To Bid'}:
                <span className="text-green-400 font-mono font-bold ml-1">
                  {(currentPrice - maxBidOrder.price).toFixed(8)}
                </span>
                <span className="text-gray-500 ml-1">
                  ({((currentPrice - maxBidOrder.price) / currentPrice * 100).toFixed(2)}%)
                </span>
              </span>
              <span>
                {language === 'zh' ? '距卖最大' : 'To Ask'}:
                <span className="text-red-400 font-mono font-bold ml-1">
                  {(maxAskOrder.price - currentPrice).toFixed(8)}
                </span>
                <span className="text-gray-500 ml-1">
                  ({((maxAskOrder.price - currentPrice) / currentPrice * 100).toFixed(2)}%)
                </span>
              </span>
            </div>
          )}

          {/* 价差显示 */}
          {maxBidOrder && maxAskOrder && (
            <div className="text-center text-xs text-gray-400 mb-1">
              <span>{language === 'zh' ? '价差' : 'Spread'}: </span>
              <span className="text-yellow-400 font-mono font-bold">
                {(maxAskOrder.price - maxBidOrder.price).toFixed(8)}
              </span>
              <span className="text-gray-500 ml-1">
                ({((maxAskOrder.price - maxBidOrder.price) / maxBidOrder.price * 100).toFixed(2)}%)
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {/* 买单最大 */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-2 space-y-2">
              <div className="flex justify-between items-center px-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-medium">
                    <span className="text-green-400 font-bold">{language === 'zh' ? '买最大' : 'BID MAX'}</span>
                  </span>
                  <span className="font-mono font-bold text-sm text-green-400">
                    {maxBidOrder ? maxBidOrder.price.toFixed(8) : '--.--'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 font-medium">{language === 'zh' ? '数量' : 'Qty'}</span>
                  <span className="font-mono font-bold text-sm text-yellow-400">
                    {maxBidOrder ? formatToK(maxBidOrder.quantity) : '--'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleFillByMaxOrder('bid')}
                disabled={!maxBidOrder}
                className={`w-full flex items-center justify-center gap-1 text-white font-bold py-1.5 rounded-lg shadow-md transition-all active:scale-95 text-[10px] tracking-wide
                  ${maxBidOrder
                    ? 'bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 border border-green-600 cursor-pointer'
                    : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <BoltIcon className="w-3 h-3" />
                {language === 'zh' ? '买最大填充' : 'Fill Bid'}
              </button>
            </div>

            {/* 卖单最大 */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-2 space-y-2">
              <div className="flex justify-between items-center px-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-medium">
                    <span className="text-red-400 font-bold">{language === 'zh' ? '卖最大' : 'ASK MAX'}</span>
                  </span>
                  <span className="font-mono font-bold text-sm text-red-400">
                    {maxAskOrder ? maxAskOrder.price.toFixed(8) : '--.--'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 font-medium">{language === 'zh' ? '数量' : 'Qty'}</span>
                  <span className="font-mono font-bold text-sm text-yellow-400">
                    {maxAskOrder ? formatToK(maxAskOrder.quantity) : '--'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleFillByMaxOrder('ask')}
                disabled={!maxAskOrder}
                className={`w-full flex items-center justify-center gap-1 text-white font-bold py-1.5 rounded-lg shadow-md transition-all active:scale-95 text-[10px] tracking-wide
                  ${maxAskOrder
                    ? 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 border border-red-600 cursor-pointer'
                    : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <BoltIcon className="w-3 h-3" />
                {language === 'zh' ? '卖最大填充' : 'Fill Ask'}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Score Tab Content */}
      {activeTab === 'score' && (
      <div className="flex-1 space-y-3 min-h-0 overflow-y-auto pr-1 custom-scrollbar">

        {/* 统计结果区域 */}
        {scoreStatus === 'done' && orders.length > 0 && (
          <>
            {/* 交易统计 */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                <ChartBarIcon className="w-3.5 h-3.5" />
                <span>{t('statsTitle')}</span>
              </label>
              <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">{t('buyTotal')}</span>
                  <span className="font-mono font-semibold text-green-400 text-xs">
                    {stats.buyTotal.toFixed(2)}
                    <span className="text-gray-500 text-[10px] ml-1">({stats.buyCount})</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-xs">{t('sellTotal')}</span>
                  <span className="font-mono font-semibold text-red-400 text-xs">
                    {stats.sellTotal.toFixed(2)}
                    <span className="text-gray-500 text-[10px] ml-1">({stats.sellCount})</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 损耗结果 和 得分 */}
            <div className="grid grid-cols-2 gap-2">
              {/* 损耗 */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                  <CalculatorIcon className="w-3.5 h-3.5" />
                  <span>{t('lossTitle')}</span>
                </label>
                <div className={`p-2 rounded-lg border ${loss >= 0 ? 'bg-red-900/20 border-red-900/50' : 'bg-green-900/20 border-green-900/50'}`}>
                  <div className={`text-lg font-bold font-mono text-center ${loss >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {loss >= 0 ? '-' : '+'}{Math.abs(loss).toFixed(2)}
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">USDT</p>
                </div>
              </div>

              {/* 得分 */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-400">
                  <StarIcon className="w-3.5 h-3.5" />
                  <span>{t('scoreTitle')}</span>
                </label>
                <div className="p-2 rounded-lg border bg-amber-900/20 border-amber-900/50">
                  <div className="text-lg font-bold font-mono text-center text-amber-400">
                    {scoreData.score}
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">{language === 'zh' ? '分' : 'pts'}</p>
                </div>
              </div>
            </div>

            {/* 公式说明 */}
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <p>{t('scoreFormula')} = {scoreData.adjustedAmount.toFixed(2)} U</p>
              {airdrops.length > 0 && (
                <p className="text-yellow-500 truncate">
                  {t('airdropDeducted')}: {airdropAmount.toFixed(2)} ({airdrops.length})
                </p>
              )}
            </div>
          </>
        )}

        {/* 无数据提示 */}
        {scoreStatus === 'done' && orders.length === 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">{t('noOrders')}</p>
          </div>
        )}

        {/* 错误提示 */}
        {scoreStatus === 'error' && (
          <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 text-center">
            <p className="text-red-400 text-sm">{errorMsg || t('failed')}</p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-auto pt-2 border-t border-gray-800">
          <button
            onClick={handleCalculateScore}
            disabled={scoreStatus === 'loading'}
            className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 rounded-lg shadow-lg transition-all
              ${scoreStatus === 'loading'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 cursor-pointer text-sm'
              }`}
          >
            <ArrowPathIcon className={`w-4 h-4 ${scoreStatus === 'loading' ? 'animate-spin' : ''}`} />
            {scoreStatus === 'loading' ? t('calculating') : (scoreStatus === 'done' ? t('recalculate') : t('calcScore'))}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default App;
