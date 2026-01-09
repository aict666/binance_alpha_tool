/**
 * 刷分计算器 - 核心逻辑
 * 用于解析币安订单历史表格并计算今日得分和损耗
 */

/**
 * 解析日期时间字符串
 * @param {string} text - 时间文本 "2025-12-19 21:33:14"
 * @returns {Date|null}
 */
export function parseDateTime(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // 格式: 2025-12-19 21:33:14
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  return new Date(
    parseInt(match[1]), // year
    parseInt(match[2]) - 1, // month (0-indexed)
    parseInt(match[3]), // day
    parseInt(match[4]), // hour
    parseInt(match[5]), // minute
    parseInt(match[6])  // second
  );
}

/**
 * 判断时间是否在今日周期内（UTC+8 8AM - 次日8AM）
 * @param {Date} date
 * @returns {boolean}
 */
export function isInTodayPeriod(date) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(8, 0, 0, 0);

  // 如果当前时间在8点之前，则今日周期从昨天8点开始
  if (now.getHours() < 8) {
    todayStart.setDate(todayStart.getDate() - 1);
  }

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  return date >= todayStart && date < todayEnd;
}

/**
 * 解析单行订单数据
 * @param {Element} row - 表格行 DOM 元素
 * @returns {Object|null} - { type: 'buy'|'sell', amount: number, token: string, time: Date }
 */
export function parseOrderRow(row) {
  // 跳过测量行
  if (row.classList.contains('bn-web-table-measure-row')) return null;

  // 时间
  const timeCell = row.querySelector('td[aria-colindex="1"]');
  const time = parseDateTime(timeCell?.textContent);
  if (!time || !isInTodayPeriod(time)) return null;

  // 代币名称
  const tokenCell = row.querySelector('td[aria-colindex="2"] div.ml-\\[8px\\]');
  const token = tokenCell?.textContent?.trim();
  if (!token) return null;

  // 买入/卖出
  const typeCell = row.querySelector('td[aria-colindex="4"] div');
  const typeText = typeCell?.textContent?.trim();
  const type = typeText === '买入' ? 'buy' : (typeText === '卖出' ? 'sell' : null);
  if (!type) return null;

  // 成交金额 (解析 "1,024.39526 USDT")
  const amountCell = row.querySelector('td[aria-colindex="9"] div');
  const amountText = amountCell?.textContent?.replace(/,/g, '').replace(/\s*USDT\s*/i, '');
  const amount = parseFloat(amountText);
  if (isNaN(amount) || amount <= 0) return null;

  // 生成唯一 ID 用于去重
  const id = `${type}-${amount}-${token}-${time.getTime()}`;

  return { type, amount, token, time, id };
}

/**
 * 收集当前可见的订单数据
 * @returns {Array} - 今日周期内的订单数组
 */
export function collectOrdersFromTable() {
  const tbody = document.querySelector('#trd-order-history tbody');
  if (!tbody) {
    return [];
  }

  const rows = tbody.querySelectorAll('tr.bn-web-table-row');
  const ordersMap = new Map(); // 用 Map 去重

  for (const row of rows) {
    const parsed = parseOrderRow(row);
    if (parsed && !ordersMap.has(parsed.id)) {
      ordersMap.set(parsed.id, parsed);
    }
  }

  // 按时间排序（最新在前）
  return Array.from(ordersMap.values()).sort((a, b) => b.time - a.time);
}

/**
 * 识别可能的空投（只有卖出没有对应买入的代币）
 * @param {Array} orders - 订单数组
 * @returns {Array} - [{ token, amount, count }, ...]
 */
export function detectAirdrops(orders) {
  const tokenStats = {};

  // 按代币统计买入/卖出
  for (const order of orders) {
    if (!tokenStats[order.token]) {
      tokenStats[order.token] = { buyCount: 0, sellCount: 0, sells: [] };
    }
    if (order.type === 'buy') {
      tokenStats[order.token].buyCount++;
    } else {
      tokenStats[order.token].sellCount++;
      tokenStats[order.token].sells.push(order);
    }
  }

  // 找出可能的空投（卖出 > 买入）
  const airdrops = [];
  for (const [token, stats] of Object.entries(tokenStats)) {
    const extraSells = stats.sellCount - stats.buyCount;
    if (extraSells > 0) {
      // 计算多出的卖出金额（取最早的几笔，因为空投通常是先卖出）
      const sellsSorted = stats.sells.sort((a, b) => a.time - b.time);
      const airdropSells = sellsSorted.slice(0, extraSells);
      const airdropAmount = airdropSells.reduce((sum, o) => sum + o.amount, 0);

      airdrops.push({
        token,
        amount: airdropAmount,
        count: extraSells
      });
    }
  }

  return airdrops;
}

/**
 * 计算交易统计（保留完整小数精度）
 * @param {Array} orders - 订单数组
 * @returns {Object} - { buyTotal, sellTotal, buyCount, sellCount }
 */
export function calculateStats(orders) {
  let buyTotal = 0;
  let sellTotal = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const order of orders) {
    if (order.type === 'buy') {
      buyTotal += order.amount;
      buyCount++;
    } else {
      sellTotal += order.amount;
      sellCount++;
    }
  }

  return {
    buyTotal,
    sellTotal,
    buyCount,
    sellCount
  };
}

/**
 * 计算损耗（计算过程保留完整精度，最终结果保留2位小数）
 * @param {Object} stats - { buyTotal, sellTotal }
 * @param {number} airdropAmount - 要扣除的空投金额
 * @returns {number} - 损耗金额（保留2位小数）
 */
export function calculateLoss(stats, airdropAmount = 0) {
  // 调整后的卖出总额 = 卖出总额 - 空投金额
  const adjustedSellTotal = stats.sellTotal - airdropAmount;
  // 卖出手续费 = 调整后卖出总额 × 0.01%（买入已含手续费，卖出不含）
  const sellFee = adjustedSellTotal * 0.0001;
  // 损耗 = 买入总额 - 卖出总额 + 卖出手续费
  const loss = stats.buyTotal - adjustedSellTotal + sellFee;
  // 只在最终结果保留2位小数
  return Math.round(loss * 100) / 100;
}

/**
 * 计算今日总得分
 * 规则：总买入金额 × 4 后，2 USDT = 1分，4 USDT = 2分，8 USDT = 3分，以此类推
 * 公式：分数 = floor(log2(总金额 × 4))
 * @param {Array} orders - 订单数组
 * @returns {{ score: number, adjustedAmount: number }} - 得分和调整后金额
 */
export function calculateTodayScore(orders) {
  // 计算总买入金额
  let totalBuyAmount = 0;
  for (const order of orders) {
    if (order.type === 'buy') {
      totalBuyAmount += order.amount;
    }
  }

  // 总金额 × 4
  const adjustedAmount = totalBuyAmount * 4;

  if (adjustedAmount < 2) {
    return { score: 0, adjustedAmount: Math.round(adjustedAmount * 100) / 100 };
  }

  // 分数 = floor(log2(adjustedAmount))
  const score = Math.floor(Math.log2(adjustedAmount));
  return { score, adjustedAmount: Math.round(adjustedAmount * 100) / 100 };
}
