// 触发 React/Vue/Angular 变更检测
function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;

  if (valueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else {
    valueSetter.call(element, value);
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function executeFill(offsetTicks, quantity, autoSubmit = false) {
  try {
    // 0. 预检查: 验证"反向订单"复选框
    const reverseOrderContainer = Array.from(document.querySelectorAll('div'))
      .find(div => div.textContent?.includes('反向订单'));

    // 找不到容器 → 提示刷新
    if (!reverseOrderContainer) {
      return {
        success: false,
        message: '未找到"反向订单"选项，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_NOT_FOUND'
      };
    }

    // 找checkbox元素
    const reverseOrderCheckbox = reverseOrderContainer.querySelector('div[role="checkbox"]');

    // checkbox不存在 → 提示刷新
    if (!reverseOrderCheckbox) {
      return {
        success: false,
        message: '未找到"反向订单"复选框，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_CHECKBOX_NOT_FOUND'
      };
    }

    // 如果未勾选 → 自动勾选
    if (reverseOrderCheckbox.getAttribute('aria-checked') !== 'true') {
      console.log("[TradeAssist] 自动勾选反向订单");
      reverseOrderCheckbox.click();

      // 等待DOM更新（勾选后会出现卖出输入框）
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证勾选是否成功
      if (reverseOrderCheckbox.getAttribute('aria-checked') !== 'true') {
        return {
          success: false,
          message: '自动勾选"反向订单"失败，请手动勾选后重试',
          errorCode: 'REVERSE_ORDER_AUTO_CHECK_FAILED'
        };
      }
    }

    // 确保在"买入"tab
    const tabs = document.querySelectorAll('[role="tab"]');
    const buyTab = Array.from(tabs).find(tab =>
      tab.textContent?.includes('买入') || tab.textContent?.includes('Buy')
    );

    if (!buyTab) {
      return {
        success: false,
        message: '未找到"买入"标签页，请刷新页面后重试',
        errorCode: 'BUY_TAB_NOT_FOUND'
      };
    }

    // 如果不在买入tab，切换过去
    if (buyTab.getAttribute('aria-selected') !== 'true') {
      console.log("[TradeAssist] 切换到买入模式");
      buyTab.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 预检查: 验证卖出价格输入框存在
    const sellPriceInput = document.querySelector('input[placeholder="限价卖出"]');
    if (!sellPriceInput) {
      return {
        success: false,
        message: '未找到卖出价格输入框，请确认"反向订单"已开启',
        errorCode: 'SELL_INPUT_NOT_FOUND'
      };
    }

    // 1. 查找容器
    const container = document.querySelector('.orderlist-container');
    if (!container) throw new Error("Order list container not found");

    // 2. 查找价格
    const priceEl = container.querySelector('.text-\\[20px\\]');
    if (!priceEl) throw new Error("Current price element not found");

    const currentPriceText = priceEl.innerText.replace(/[^\d.]/g, '');
    const currentPrice = parseFloat(currentPriceText);

    if (isNaN(currentPrice)) throw new Error("Failed to parse current price");

    // 3. 查找限价输入框和步长
    const limitPriceInput = document.querySelector('#limitPrice');
    if (!limitPriceInput) throw new Error("Limit Price input (#limitPrice) not found");

    const stepAttr = limitPriceInput.getAttribute('step');
    const stepValue = parseFloat(stepAttr);

    if (isNaN(stepValue)) throw new Error("Limit Price input has no valid step attribute");

    // 4. 计算价格
    const precision = Math.abs(Math.floor(Math.log10(stepValue)));
    const safePrecision = precision > 20 ? 8 : precision;

    const delta = stepValue * offsetTicks;
    const buyPrice = (currentPrice + delta).toFixed(safePrecision);
    const sellPrice = (currentPrice - delta).toFixed(safePrecision);

    console.log(`[TradeAssist] Price: ${currentPrice}, Step: ${stepValue}, Offset: ${offsetTicks}, Qty: ${quantity}`);

    // 5. 填充输入框

    // A. 买入价格输入框
    setNativeValue(limitPriceInput, buyPrice);

    // B. 数量输入框
    const amountInputs = Array.from(document.querySelectorAll('input[placeholder*="最小"]'));
    let amountFilled = false;
    amountInputs.forEach(input => {
      setNativeValue(input, quantity.toString());
      amountFilled = true;
    });

    if (!amountFilled) console.warn("[TradeAssist] Amount input not found");

    // C. 卖出价格输入框
    setNativeValue(sellPriceInput, sellPrice);

    // 6. 自动点击买入按钮
    if (autoSubmit) {
      const buyBtn = document.querySelector('.bn-button.bn-button__buy');
      if (buyBtn) {
        console.log("[TradeAssist] Auto-clicking BUY button");
        buyBtn.click();
      } else {
        console.warn("[TradeAssist] Auto-submit enabled but Buy button not found");
      }
    }

    return { success: true };

  } catch (error) {
    console.error("[TradeAssist] Error:", error);
    return { success: false, message: error.message };
  }
}

export async function executeQuickSell() {
  try {
    console.log("[TradeAssist] 开始执行快速卖出");

    // Step 0: 确保"反向订单"是关闭的
    const reverseOrderContainer = Array.from(document.querySelectorAll('div'))
      .find(div => div.textContent?.includes('反向订单'));

    if (!reverseOrderContainer) {
      return {
        success: false,
        message: '未找到"反向订单"选项，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_NOT_FOUND'
      };
    }

    const reverseOrderCheckbox = reverseOrderContainer.querySelector('div[role="checkbox"]');

    if (!reverseOrderCheckbox) {
      return {
        success: false,
        message: '未找到"反向订单"复选框，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_CHECKBOX_NOT_FOUND'
      };
    }

    // 如果已勾选 → 自动取消勾选
    if (reverseOrderCheckbox.getAttribute('aria-checked') === 'true') {
      console.log("[TradeAssist] 自动取消勾选反向订单");
      reverseOrderCheckbox.click();

      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 200));

      // 验证取消勾选是否成功
      if (reverseOrderCheckbox.getAttribute('aria-checked') === 'true') {
        return {
          success: false,
          message: '自动取消"反向订单"失败，请手动取消后重试',
          errorCode: 'REVERSE_ORDER_AUTO_UNCHECK_FAILED'
        };
      }
    }

    // Step 1: 切换到卖出模式 - 使用文本匹配查找卖出tab
    const tabs = document.querySelectorAll('[role="tab"]');
    const sellTab = Array.from(tabs).find(tab =>
      tab.textContent?.includes('卖出') || tab.textContent?.includes('Sell')
    );

    if (!sellTab) {
      return {
        success: false,
        message: '未找到卖出标签页',
        errorCode: 'SELL_TAB_NOT_FOUND'
      };
    }

    // 检查是否已经在卖出模式（aria-selected="true" 表示选中）
    if (sellTab.getAttribute('aria-selected') !== 'true') {
      console.log("[TradeAssist] 切换到卖出模式");
      sellTab.click();
      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Step 2: 读取当前价格
    const priceSpan = document.querySelector("#alphaOrderbook > div.orderlist-container > div.px-4.flex.items-center.justify-between > div:nth-child(1) > span");
    if (!priceSpan) {
      return {
        success: false,
        message: '未找到当前价格元素',
        errorCode: 'PRICE_NOT_FOUND'
      };
    }

    const currentPriceText = priceSpan.innerText.replace(/[^\d.]/g, '');
    const currentPrice = parseFloat(currentPriceText);

    if (isNaN(currentPrice)) {
      return {
        success: false,
        message: '无法解析当前价格',
        errorCode: 'PRICE_PARSE_ERROR'
      };
    }

    console.log(`[TradeAssist] 当前价格: ${currentPrice}`);

    // Step 3: 获取限价输入框和精度
    const limitPriceInput = document.querySelector("#limitPrice");
    if (!limitPriceInput) {
      return {
        success: false,
        message: '未找到限价输入框',
        errorCode: 'LIMIT_PRICE_INPUT_NOT_FOUND'
      };
    }

    const stepAttr = limitPriceInput.getAttribute('step');
    const stepValue = parseFloat(stepAttr);

    if (isNaN(stepValue)) {
      return {
        success: false,
        message: '无法获取价格步长',
        errorCode: 'STEP_VALUE_ERROR'
      };
    }

    // 计算精度
    const precision = Math.abs(Math.floor(Math.log10(stepValue)));
    const safePrecision = precision > 20 ? 8 : precision;

    // 计算卖出价格 = 当前价格 - 3个tick
    const sellPrice = (currentPrice - stepValue * 3).toFixed(safePrecision);
    console.log(`[TradeAssist] 卖出价格: ${sellPrice} (步长: ${stepValue}, 精度: ${safePrecision})`);

    // 填充卖出价格
    setNativeValue(limitPriceInput, sellPrice);

    // Step 4: 读取持仓数量
    const amountDiv = document.querySelector("#__APP > div > div.bg-TradeBg.md\\:pt-\\[4px\\].h-\\[1097px\\].relative.flex-layout-container > div > div:nth-child(9) > div > div > div > div > div.bn-flex.h-auto.md\\:h-\\[310px\\].flex-col.justify-start.gap-y-\\[8px\\].mt-\\[8px\\] > div.flex.flex-col.gap-\\[10px\\] > div.bn-flex.flex.flex-col.gap-\\[4px\\] > div.bn-flex.space-x-\\[4px\\].py-\\[2px\\].items-center > div > div > div > div.bn-flex.gap-\\[4px\\].items-center > div");

    if (!amountDiv) {
      return {
        success: false,
        message: '未找到持仓数量元素',
        errorCode: 'AMOUNT_DIV_NOT_FOUND'
      };
    }

    const amountText = amountDiv.innerText; // 例如 "5,930.37 OWL"
    const amountMatch = amountText.replace(/,/g, '').match(/[\d.]+/);

    if (!amountMatch) {
      return {
        success: false,
        message: '无法从持仓中提取数量',
        errorCode: 'AMOUNT_PARSE_ERROR'
      };
    }

    const amount = amountMatch[0];
    console.log(`[TradeAssist] 持仓数量: ${amount}`);

    // Step 5: 填充数量输入框
    const limitAmountInput = document.querySelector("#limitAmount");
    if (!limitAmountInput) {
      return {
        success: false,
        message: '未找到数量输入框',
        errorCode: 'AMOUNT_INPUT_NOT_FOUND'
      };
    }

    setNativeValue(limitAmountInput, amount);

    // Step 6: 点击卖出按钮
    const sellBtn = document.querySelector("#__APP > div > div.bg-TradeBg.md\\:pt-\\[4px\\].h-\\[1097px\\].relative.flex-layout-container > div > div:nth-child(9) > div > div > div > div > div.bn-flex.h-auto.md\\:h-\\[310px\\].flex-col.justify-start.gap-y-\\[8px\\].mt-\\[8px\\] > div.flex.flex-col.gap-\\[10px\\] > button");

    if (!sellBtn) {
      return {
        success: false,
        message: '未找到卖出按钮',
        errorCode: 'SELL_BUTTON_NOT_FOUND'
      };
    }

    console.log("[TradeAssist] 点击卖出按钮");
    sellBtn.click();

    return {
      success: true,
      message: '快速卖出执行成功'
    };

  } catch (error) {
    console.error("[TradeAssist] 快速卖出错误:", error);
    return { success: false, message: error.message };
  }
}

// 全部取消：切换到当前委托tab，点击全部取消
export async function executeCancelAll() {
  try {
    console.log("[TradeAssist] 开始执行全部取消");

    // Step 1: 切换到"当前委托"tab
    const openOrdersTab = document.querySelector('#bn-tab-orderOrder') ||
                          document.querySelector('[data-tab-key="orderOrder"]');

    if (!openOrdersTab) {
      return {
        success: false,
        message: '未找到"当前委托"标签页',
        errorCode: 'OPEN_ORDERS_TAB_NOT_FOUND'
      };
    }

    if (openOrdersTab.getAttribute('aria-selected') !== 'true') {
      console.log("[TradeAssist] 切换到当前委托");
      openOrdersTab.click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 2: 点击全部取消
    const cancelAllBtn = document.querySelector("#bn-tab-pane-orderOrder > div > div.bn-web-table-wrapper.bn-web-table-wrapper__filled.bn-web-table-wrapper__row-small.bn-web-table-wrapper__padding-default > div > div > div.bn-web-table-header > table > thead > tr > th:nth-child(11) > div");

    if (!cancelAllBtn) {
      return {
        success: false,
        message: '未找到"全部取消"按钮',
        errorCode: 'CANCEL_ALL_BTN_NOT_FOUND'
      };
    }

    console.log("[TradeAssist] 点击全部取消");
    cancelAllBtn.click();

    return {
      success: true,
      message: '全部取消执行成功'
    };

  } catch (error) {
    console.error("[TradeAssist] 全部取消错误:", error);
    return { success: false, message: error.message };
  }
}

// 根据指定价格填充（用于最大委托量填充）
export async function executeFillWithPrice(targetPrice, offsetTicks, quantity, autoSubmit = false) {
  try {
    // 0. 预检查: 验证"反向订单"复选框
    const reverseOrderContainer = Array.from(document.querySelectorAll('div'))
      .find(div => div.textContent?.includes('反向订单'));

    if (!reverseOrderContainer) {
      return {
        success: false,
        message: '未找到"反向订单"选项，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_NOT_FOUND'
      };
    }

    const reverseOrderCheckbox = reverseOrderContainer.querySelector('div[role="checkbox"]');

    if (!reverseOrderCheckbox) {
      return {
        success: false,
        message: '未找到"反向订单"复选框，请刷新页面后重试',
        errorCode: 'REVERSE_ORDER_CHECKBOX_NOT_FOUND'
      };
    }

    // 如果未勾选 → 自动勾选
    if (reverseOrderCheckbox.getAttribute('aria-checked') !== 'true') {
      console.log("[TradeAssist] 自动勾选反向订单");
      reverseOrderCheckbox.click();
      await new Promise(resolve => setTimeout(resolve, 200));

      if (reverseOrderCheckbox.getAttribute('aria-checked') !== 'true') {
        return {
          success: false,
          message: '自动勾选"反向订单"失败，请手动勾选后重试',
          errorCode: 'REVERSE_ORDER_AUTO_CHECK_FAILED'
        };
      }
    }

    // 确保在"买入"tab
    const tabs = document.querySelectorAll('[role="tab"]');
    const buyTab = Array.from(tabs).find(tab =>
      tab.textContent?.includes('买入') || tab.textContent?.includes('Buy')
    );

    if (!buyTab) {
      return {
        success: false,
        message: '未找到"买入"标签页，请刷新页面后重试',
        errorCode: 'BUY_TAB_NOT_FOUND'
      };
    }

    if (buyTab.getAttribute('aria-selected') !== 'true') {
      console.log("[TradeAssist] 切换到买入模式");
      buyTab.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 预检查: 验证卖出价格输入框存在
    const sellPriceInput = document.querySelector('input[placeholder="限价卖出"]');
    if (!sellPriceInput) {
      return {
        success: false,
        message: '未找到卖出价格输入框，请确认"反向订单"已开启',
        errorCode: 'SELL_INPUT_NOT_FOUND'
      };
    }

    // 获取限价输入框和步长
    const limitPriceInput = document.querySelector('#limitPrice');
    if (!limitPriceInput) {
      return {
        success: false,
        message: '未找到限价输入框',
        errorCode: 'LIMIT_PRICE_INPUT_NOT_FOUND'
      };
    }

    const stepAttr = limitPriceInput.getAttribute('step');
    const stepValue = parseFloat(stepAttr);

    if (isNaN(stepValue)) {
      return {
        success: false,
        message: '无法获取价格步长',
        errorCode: 'STEP_VALUE_ERROR'
      };
    }

    // 计算精度
    const precision = Math.abs(Math.floor(Math.log10(stepValue)));
    const safePrecision = precision > 20 ? 8 : precision;

    // 买入价格 = 委托价格 + 偏移，卖出价格 = 委托价格 - 偏移
    const buyPrice = (targetPrice + stepValue * offsetTicks).toFixed(safePrecision);
    const sellPrice = (targetPrice - stepValue * offsetTicks).toFixed(safePrecision);

    console.log(`[TradeAssist] 指定价格填充: Buy=${buyPrice}, Sell=${sellPrice}, Qty=${quantity}`);

    // 填充输入框
    setNativeValue(limitPriceInput, buyPrice);

    const amountInputs = Array.from(document.querySelectorAll('input[placeholder*="最小"]'));
    amountInputs.forEach(input => {
      setNativeValue(input, quantity.toString());
    });

    setNativeValue(sellPriceInput, sellPrice);

    // 自动点击买入按钮
    if (autoSubmit) {
      const buyBtn = document.querySelector('.bn-button.bn-button__buy');
      if (buyBtn) {
        console.log("[TradeAssist] Auto-clicking BUY button");
        buyBtn.click();
      }
    }

    return { success: true };

  } catch (error) {
    console.error("[TradeAssist] 指定价格填充错误:", error);
    return { success: false, message: error.message };
  }
}
