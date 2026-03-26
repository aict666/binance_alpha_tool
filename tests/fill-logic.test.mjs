import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { executeFill, executeFillWithPrice } from '../src/content/fill-logic.js';

class FakeElement {
  constructor({ textContent = '', innerText = '', attrs = {} } = {}) {
    this.textContent = textContent;
    this.innerText = innerText || textContent;
    this.attrs = { ...attrs };
    this.queryMap = new Map();
    this.clicked = false;
    this.dispatchedEvents = [];
  }

  getAttribute(name) {
    return this.attrs[name] ?? null;
  }

  setAttribute(name, value) {
    this.attrs[name] = value;
  }

  querySelector(selector) {
    return this.queryMap.get(selector) ?? null;
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

  globalThis.document = {
    querySelector(selector) {
      return querySelectorMap.get(selector) ?? null;
    },
    querySelectorAll(selector) {
      return querySelectorAllMap.get(selector) ?? [];
    }
  };

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
