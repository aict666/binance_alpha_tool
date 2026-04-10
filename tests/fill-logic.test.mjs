import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { executeFill, executeFillWithPrice, executeQuickSell } from '../src/content/fill-logic.js';

function normalizeClasses(className = '') {
  return className
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function decodeCssToken(token = '') {
  return token.replace(/\\(.)/g, '$1');
}

function matchesSelector(element, selector) {
  const trimmedSelector = selector.trim();

  if (!trimmedSelector) {
    return false;
  }

  if (trimmedSelector === '*') {
    return true;
  }

  const tagMatch = trimmedSelector.match(/^[a-zA-Z]+/);
  const expectedTag = tagMatch ? tagMatch[0].toUpperCase() : null;

  if (expectedTag && element.tagName !== expectedTag) {
    return false;
  }

  const idMatches = [...trimmedSelector.matchAll(/#([A-Za-z0-9_-]+)/g)];
  if (idMatches.length > 0) {
    const actualId = element.getAttribute('id');
    if (!actualId || idMatches.some(match => match[1] !== actualId)) {
      return false;
    }
  }

  const classMatches = [...trimmedSelector.matchAll(/\.((?:\\.|[A-Za-z0-9_\-\[\]:])+)/g)];
  if (classMatches.length > 0) {
    const actualClasses = normalizeClasses(element.getAttribute('class') || '');
    const expectedClasses = classMatches.map(match => decodeCssToken(match[1]));

    if (expectedClasses.some(cls => !actualClasses.includes(cls))) {
      return false;
    }
  }

  const attributeMatches = [...trimmedSelector.matchAll(/\[([^\]=*]+)(\*?=)"([^"]*)"\]/g)];
  if (attributeMatches.length > 0) {
    for (const [, rawName, operator, rawValue] of attributeMatches) {
      const attrName = rawName.trim();
      const expectedValue = decodeCssToken(rawValue);
      const actualValue = element.getAttribute(attrName);

      if (actualValue === null) {
        return false;
      }

      if (operator === '=' && actualValue !== expectedValue) {
        return false;
      }

      if (operator === '*=' && !actualValue.includes(expectedValue)) {
        return false;
      }
    }
  }

  return true;
}

function collectMatches(node, selectors, matches) {
  for (const selector of selectors) {
    if (matchesSelector(node, selector)) {
      matches.push(node);
      break;
    }
  }

  for (const child of node.children) {
    collectMatches(child, selectors, matches);
  }
}

class FakeElement {
  constructor({ tagName = 'div', textContent = '', innerText = '', attrs = {} } = {}) {
    this.tagName = tagName.toUpperCase();
    this._textContent = textContent;
    this._innerText = innerText || textContent;
    this.attrs = { ...attrs };
    this.queryMap = new Map();
    this.queryAllMap = new Map();
    this.children = [];
    this.parentElement = null;
    this.clicked = false;
    this.dispatchedEvents = [];
  }

  get textContent() {
    if (this._textContent) {
      return this._textContent;
    }

    if (this.children.length === 0) {
      return '';
    }

    return this.children.map(child => child.textContent).join('');
  }

  set textContent(value) {
    this._textContent = value;
  }

  get innerText() {
    if (this._innerText) {
      return this._innerText;
    }

    if (this.children.length === 0) {
      return this._textContent || '';
    }

    return this.children.map(child => child.innerText).join(' ');
  }

  set innerText(value) {
    this._innerText = value;
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  setAttribute(name, value) {
    this.attrs[name] = value;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (this.queryMap.has(selector)) {
      return this.queryMap.get(selector);
    }

    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    if (this.queryAllMap.has(selector)) {
      return this.queryAllMap.get(selector);
    }

    const selectors = selector
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const matches = [];
    for (const child of this.children) {
      collectMatches(child, selectors, matches);
    }

    return matches;
  }

  click() {
    this.clicked = true;
  }

  dispatchEvent(event) {
    this.dispatchedEvents.push(event.type);
    return true;
  }
}

class FakeInput extends FakeElement {}

Object.defineProperty(FakeInput.prototype, 'value', {
  get() {
    return this._value ?? '';
  },
  set(nextValue) {
    this._value = String(nextValue);
  }
});

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalEvent = globalThis.Event;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.Event = originalEvent;
});

function createFakeDocument({ body = null, querySelectorMap = new Map(), querySelectorAllMap = new Map() } = {}) {
  return {
    body,
    querySelector(selector) {
      if (querySelectorMap.has(selector)) {
        return querySelectorMap.get(selector);
      }

      return body?.querySelector(selector) ?? null;
    },
    querySelectorAll(selector) {
      if (querySelectorAllMap.has(selector)) {
        return querySelectorAllMap.get(selector);
      }

      return body?.querySelectorAll(selector) ?? [];
    }
  };
}

function createElement(tagName = 'div', options = {}) {
  return new FakeElement({ tagName, ...options });
}

function installReverseOrderBuyDom({ includeSellPriceInput = true } = {}) {
  const reverseOrderCheckbox = new FakeElement({
    attrs: { 'aria-checked': 'true' }
  });
  reverseOrderCheckbox.click = function click() {
    this.clicked = true;
    this.attrs['aria-checked'] = this.attrs['aria-checked'] === 'true' ? 'false' : 'true';
  };

  const reverseOrderContainer = new FakeElement({ textContent: '反向订单' });
  reverseOrderContainer.queryMap.set('div[role="checkbox"]', reverseOrderCheckbox);

  const buyTab = new FakeElement({
    textContent: '买入',
    attrs: { 'aria-selected': 'true' }
  });

  const priceEl = new FakeElement({ innerText: '0.18400000' });
  const container = new FakeElement();
  container.queryMap.set('.text-\\[20px\\]', priceEl);

  const limitPriceInput = new FakeInput({ attrs: { step: '1e-8' } });
  const amountInput = new FakeInput();
  const sellPriceInput = includeSellPriceInput
    ? new FakeInput({
        attrs: {
          id: 'limitTotal',
          placeholder: '限价卖单价格',
          step: '1e-8'
        }
      })
    : null;

  const querySelectorMap = new Map([
    ['.orderlist-container', container],
    ['#limitPrice', limitPriceInput],
    ['input#limitTotal[placeholder="限价卖单价格"]', sellPriceInput]
  ]);

  const querySelectorAllMap = new Map([
    ['div', [reverseOrderContainer]],
    ['[role="tab"]', [buyTab]],
    ['input[placeholder*="最小"]', [amountInput]]
  ]);

  globalThis.document = createFakeDocument({ querySelectorMap, querySelectorAllMap });

  globalThis.window = { HTMLInputElement: FakeInput };
  globalThis.Event = originalEvent ?? class Event {
    constructor(type) {
      this.type = type;
    }
  };

  return {
    limitPriceInput,
    amountInput,
    sellPriceInput
  };
}

function installQuickSellDom({ includeAvailableRow = true } = {}) {
  const body = createElement('body');

  const reverseOrderCheckbox = createElement('div', {
    attrs: { role: 'checkbox', 'aria-checked': 'true' }
  });
  reverseOrderCheckbox.click = function click() {
    this.clicked = true;
    this.attrs['aria-checked'] = this.attrs['aria-checked'] === 'true' ? 'false' : 'true';
  };

  const reverseOrderContainer = createElement('div', { textContent: '反向订单' });
  reverseOrderContainer.appendChild(reverseOrderCheckbox);
  body.appendChild(reverseOrderContainer);

  const buyTab = createElement('button', {
    textContent: '买入',
    attrs: { role: 'tab', 'aria-selected': 'true' }
  });
  const sellTab = createElement('button', {
    textContent: '卖出',
    attrs: { role: 'tab', 'aria-selected': 'false' }
  });

  buyTab.click = function click() {
    this.clicked = true;
    this.attrs['aria-selected'] = 'true';
    sellTab.attrs['aria-selected'] = 'false';
  };
  sellTab.click = function click() {
    this.clicked = true;
    this.attrs['aria-selected'] = 'true';
    buyTab.attrs['aria-selected'] = 'false';
  };

  body.appendChild(buyTab);
  body.appendChild(sellTab);

  const orderListContainer = createElement('div', {
    attrs: { class: 'orderlist-container' }
  });
  const priceEl = createElement('div', {
    innerText: '0.18400000',
    attrs: { class: 'text-[20px]' }
  });
  orderListContainer.appendChild(priceEl);
  body.appendChild(orderListContainer);

  const quickSellScope = createElement('div', {
    attrs: { class: 'quick-sell-scope' }
  });
  const limitPriceInput = new FakeInput({
    tagName: 'input',
    attrs: { id: 'limitPrice', step: '1e-8' }
  });
  const limitAmountInput = new FakeInput({
    tagName: 'input',
    attrs: { id: 'limitAmount' }
  });
  const sellButton = createElement('button', {
    textContent: '卖出',
    attrs: { class: 'bn-button bn-button__sell' }
  });

  const priceInputWrap = createElement('div');
  priceInputWrap.appendChild(limitPriceInput);
  quickSellScope.appendChild(priceInputWrap);

  if (includeAvailableRow) {
    const availableRow = createElement('div', {
      attrs: { class: 'bn-flex flex flex-col gap-[4px]' }
    });
    const availableLine = createElement('div', {
      attrs: { class: 'bn-flex space-x-[4px] py-[2px] items-center' }
    });
    const labelContainer = createElement('div', {
      attrs: { class: 't-caption1 text-TertiaryText flex-1' }
    });
    const labelWrap = createElement('div', {
      attrs: { class: 'bn-flex h-full w-full' }
    });
    const labelContent = createElement('div', {
      attrs: { class: 'bn-flex text-TertiaryText items-center justify-between w-full' }
    });
    const labelBlock = createElement('div', {
      attrs: { class: 'mr-[4px]' }
    });
    const labelTooltip = createElement('div', {
      attrs: { class: 'bn-tooltips-wrap bn-tooltips-web' }
    });
    const labelTooltipEle = createElement('div', {
      attrs: { class: 'bn-tooltips-ele cursor-help' }
    });
    const labelText = createElement('div', {
      innerText: '可用',
      attrs: { class: 'text-SecondaryText md:text-TertiaryText t-caption1 cursor-help border-0 border-b border-dotted !leading-[15px]' }
    });
    const valueWrap = createElement('div', {
      attrs: { class: 'bn-flex gap-[4px] items-center' }
    });
    const valueText = createElement('div', {
      innerText: '0.086857 UP',
      attrs: { class: 'text-PrimaryText text-[12px] leading-[18px] font-[500]' }
    });

    labelTooltipEle.appendChild(labelText);
    labelTooltip.appendChild(labelTooltipEle);
    labelBlock.appendChild(labelTooltip);
    valueWrap.appendChild(valueText);
    labelContent.appendChild(labelBlock);
    labelContent.appendChild(valueWrap);
    labelWrap.appendChild(labelContent);
    labelContainer.appendChild(labelWrap);
    availableLine.appendChild(labelContainer);
    availableRow.appendChild(availableLine);

    const feeRow = createElement('div', {
      innerText: '预估手续费 -- USDT',
      attrs: { class: 'flex items-center justify-between gap-[4px] text-[12px] leading-[18px] font-[400] pt-[2px] pb-[1px]' }
    });
    availableRow.appendChild(feeRow);
    quickSellScope.appendChild(availableRow);
  }

  const amountInputWrap = createElement('div');
  amountInputWrap.appendChild(limitAmountInput);
  quickSellScope.appendChild(amountInputWrap);
  quickSellScope.appendChild(sellButton);
  body.appendChild(quickSellScope);

  globalThis.document = createFakeDocument({ body });
  globalThis.window = { HTMLInputElement: FakeInput };
  globalThis.Event = originalEvent ?? class Event {
    constructor(type) {
      this.type = type;
    }
  };

  return {
    reverseOrderCheckbox,
    sellTab,
    limitPriceInput,
    limitAmountInput,
    sellButton
  };
}

test('executeFill 在当前 DOM 下会写入反向订单卖出价格框', async () => {
  const { limitPriceInput, amountInput, sellPriceInput } = installReverseOrderBuyDom();

  const result = await executeFill(3, 12.34, false);

  assert.equal(result.success, true);
  assert.equal(limitPriceInput.value, '0.18400003');
  assert.equal(amountInput.value, '12.34');
  assert.equal(sellPriceInput.value, '0.18399997');
});

test('executeFillWithPrice 在当前 DOM 下会写入反向订单卖出价格框', async () => {
  const { limitPriceInput, amountInput, sellPriceInput } = installReverseOrderBuyDom();

  const result = await executeFillWithPrice(0.184, 3, 12.34, false);

  assert.equal(result.success, true);
  assert.equal(result.buyPrice, 0.18400003);
  assert.equal(limitPriceInput.value, '0.18400003');
  assert.equal(amountInput.value, '12.34');
  assert.equal(sellPriceInput.value, '0.18399997');
});

test('当前 DOM 中缺少反向订单卖出价格框时仍返回原错误码', async () => {
  installReverseOrderBuyDom({ includeSellPriceInput: false });

  const result = await executeFill(3, 12.34, false);

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'SELL_INPUT_NOT_FOUND');
});

test('executeQuickSell 在当前 DOM 下会读取可用数量并点击卖出按钮', async () => {
  const { reverseOrderCheckbox, sellTab, limitPriceInput, limitAmountInput, sellButton } = installQuickSellDom();

  const result = await executeQuickSell();

  assert.equal(result.success, true);
  assert.equal(reverseOrderCheckbox.getAttribute('aria-checked'), 'false');
  assert.equal(sellTab.getAttribute('aria-selected'), 'true');
  assert.equal(limitPriceInput.value, '0.18399997');
  assert.equal(limitAmountInput.value, '0.086857');
  assert.equal(sellButton.clicked, true);
});

test('旧绝对路径失效时 executeQuickSell 仍能通过语义 DOM 查找到可用数量', async () => {
  const { limitAmountInput, sellButton } = installQuickSellDom();

  const result = await executeQuickSell();

  assert.equal(result.success, true);
  assert.equal(limitAmountInput.value, '0.086857');
  assert.equal(sellButton.clicked, true);
});

test('缺少可用数量行时 executeQuickSell 返回原错误码', async () => {
  installQuickSellDom({ includeAvailableRow: false });

  const result = await executeQuickSell();

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'AMOUNT_DIV_NOT_FOUND');
});
