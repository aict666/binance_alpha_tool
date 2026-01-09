/**
 * 今日损耗计算器 - 核心逻辑
 * 用于解析币安消息页面的交易记录并计算损耗
 */

// 买单正则: 您使用1023.999192 USDT限价买入2432.88 ESPORTS的Alpha订单已成交
const buyRegex = /您使用([\d.]+)\s*USDT限价买入[\d.]+\s*(\w+)/;

// 卖单正则: 您以1023.893967 USDT的总额，限价卖出2432.63 ESPORTS的Alpha订单已成交
const sellRegex = /您以([\d.]+)\s*USDT的总额，限价卖出[\d.]+\s*(\w+)/;

// 时间正则
const timeOnlyRegex = /^(\d{2}):(\d{2}):(\d{2})$/; // 09:10:02
const yesterdayRegex = /^昨天(\d{2}):(\d{2}):(\d{2})$/; // 昨天11:26:58
const dateTimeRegex = /^(\d{1,2})\/(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})$/; // 12/12 18:14:57

/**
 * 解析时间文本为 Date 对象
 * @param {string} timeText - 时间文本
 * @returns {Date|null}
 */
export function parseTimeText(timeText) {
  const now = new Date();
  const trimmed = timeText.trim();

  // 今天: 09:10:02
  let match = trimmed.match(timeOnlyRegex);
  if (match) {
    const date = new Date(now);
    date.setHours(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 0);
    return date;
  }

  // 昨天: 昨天11:26:58
  match = trimmed.match(yesterdayRegex);
  if (match) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 0);
    return date;
  }

  // 更早日期: 12/12 18:14:57
  match = trimmed.match(dateTimeRegex);
  if (match) {
    const date = new Date(now);
    date.setMonth(parseInt(match[1]) - 1);
    date.setDate(parseInt(match[2]));
    date.setHours(parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), 0);
    // 如果日期在未来，说明是去年
    if (date > now) {
      date.setFullYear(date.getFullYear() - 1);
    }
    return date;
  }

  return null;
}

/**
 * 判断时间是否在今日周期内（8AM - 次日8AM）
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
 * 解析单条消息元素
 * @param {Element} element - 消息 DOM 元素
 * @returns {Object|null} - { type: 'buy'|'sell', amount: number, token: string, time: Date, id: string }
 */
export function parseMessage(element) {
  const titleEl = element.querySelector('.Subtitle1');
  const contentEl = element.querySelector('.Body3 .relative');
  const timeEl = element.querySelector('.Caption1');

  if (!titleEl || !contentEl || !timeEl) return null;

  const title = titleEl.textContent || '';
  const content = contentEl.textContent || '';
  const timeText = timeEl.textContent || '';

  // 判断是买单还是卖单
  let type = null;
  let amount = 0;
  let token = '';

  if (title.includes('买单已成交')) {
    const match = content.match(buyRegex);
    if (match) {
      type = 'buy';
      amount = parseFloat(match[1]);
      token = match[2];
    }
  } else if (title.includes('卖单已成交')) {
    const match = content.match(sellRegex);
    if (match) {
      type = 'sell';
      amount = parseFloat(match[1]);
      token = match[2];
    }
  }

  if (!type) return null;

  const time = parseTimeText(timeText);
  if (!time) return null;

  // 生成唯一 ID 用于去重
  const id = `${type}-${amount}-${token}-${time.getTime()}`;

  return { type, amount, token, time, id };
}

/**
 * 延迟函数
 * @param {number} ms
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 自动滚动并收集消息
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array>} - 今日周期内的消息数组
 */
export async function autoScrollAndCollect(onProgress) {
  const container = document.querySelector('.infinite-list-scroll');
  if (!container) {
    throw new Error('未找到消息列表容器');
  }

  const messagesMap = new Map(); // 用 Map 去重
  let lastMessageCount = 0;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    // 收集当前可见的消息
    const elements = container.querySelectorAll('.underline-wrapper');
    for (const el of elements) {
      const parsed = parseMessage(el);
      if (parsed && !messagesMap.has(parsed.id)) {
        messagesMap.set(parsed.id, parsed);
      }
    }

    const messages = Array.from(messagesMap.values());
    onProgress && onProgress(messages.length);

    // 检查最早的消息是否已超出今日范围
    // 按时间排序，找到最早的消息
    const sortedByTime = [...messages].sort((a, b) => a.time - b.time);
    const earliest = sortedByTime[0];
    if (earliest && !isInTodayPeriod(earliest.time)) {
      break; // 已获取足够数据
    }

    // 滚动加载更多
    container.scrollTop = container.scrollHeight;
    await delay(800);

    // 检查是否有新数据加载
    if (messages.length === lastMessageCount) {
      retryCount++;
    } else {
      retryCount = 0;
      lastMessageCount = messages.length;
    }
  }

  // 过滤只保留今日范围内的消息，并按时间排序（最新在前）
  const allMessages = Array.from(messagesMap.values());
  const todayMessages = allMessages
    .filter(m => isInTodayPeriod(m.time))
    .sort((a, b) => b.time - a.time);

  return todayMessages;
}

/**
 * 识别可能的空投（只有卖出没有对应买入的代币）
 * @param {Array} messages - 消息数组
 * @returns {Array} - [{ token, amount, count }, ...]
 */
export function detectAirdrops(messages) {
  const tokenStats = {};

  // 按代币统计买入/卖出
  for (const msg of messages) {
    if (!tokenStats[msg.token]) {
      tokenStats[msg.token] = { buyCount: 0, sellCount: 0, sells: [] };
    }
    if (msg.type === 'buy') {
      tokenStats[msg.token].buyCount++;
    } else {
      tokenStats[msg.token].sellCount++;
      tokenStats[msg.token].sells.push(msg);
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
      const airdropAmount = airdropSells.reduce((sum, m) => sum + m.amount, 0);

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
 * @param {Array} messages - 消息数组
 * @returns {Object} - { buyTotal, sellTotal, buyCount, sellCount }
 */
export function calculateStats(messages) {
  let buyTotal = 0;
  let sellTotal = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const msg of messages) {
    if (msg.type === 'buy') {
      buyTotal += msg.amount;
      buyCount++;
    } else {
      sellTotal += msg.amount;
      sellCount++;
    }
  }

  // 计算过程保留完整精度，不进行四舍五入
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
  // 净差额 = 买入总额 - 调整后卖出总额
  const netDiff = stats.buyTotal - adjustedSellTotal;
  // 损耗 = 净差额 × 2
  const loss = netDiff * 2;
  // 只在最终结果保留2位小数
  return Math.round(loss * 100) / 100;
}

/**
 * 计算今日总得分
 * 规则：总买入金额 × 4 后，2 USDT = 1分，4 USDT = 2分，8 USDT = 3分，以此类推
 * 公式：分数 = floor(log2(总金额 × 4))
 * 例如：买入 5119 USDT × 4 = 20476，log2(20476) ≈ 14.32，得分 = 14
 * @param {Array} messages - 消息数组
 * @returns {{ score: number, adjustedAmount: number }} - 得分和调整后金额
 */
export function calculateTodayScore(messages) {
  // 计算总买入金额
  let totalBuyAmount = 0;
  for (const msg of messages) {
    if (msg.type === 'buy') {
      totalBuyAmount += msg.amount;
    }
  }

  // 总金额 × 4
  const adjustedAmount = totalBuyAmount * 4;

  if (adjustedAmount < 2) {
    return { score: 0, adjustedAmount: Math.round(adjustedAmount * 100) / 100 };
  }

  // 分数 = floor(log2(adjustedAmount))
  // 2 -> 1分, 4 -> 2分, 8 -> 3分, 16384 -> 14分, 32768 -> 15分
  const score = Math.floor(Math.log2(adjustedAmount));
  return { score, adjustedAmount: Math.round(adjustedAmount * 100) / 100 };
}
