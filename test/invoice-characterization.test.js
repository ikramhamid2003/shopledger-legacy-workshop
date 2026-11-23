'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: ledger applies HSN rates and coupon discount before GST', () => {
  const items = [
    { id: 8, name: 'Assam tea', hsn: '0902', price: 140, qty: 2 },
    { id: 2, name: 'Toor dal', hsn: '0713', price: 165, qty: 2 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 610,
    discount: 61,
    taxable: 549,
    tax: 60.21,
    cgst: 30.11,
    sgst: 30.1,
    total: 609.21,
    lines: [
      { id: 8, name: 'Assam tea', hsn: '0902', gstPercent: 18, gross: 280, discount: 28, taxable: 252, tax: 45.36, net: 297.36 },
      { id: 2, name: 'Toor dal', hsn: '0713', gstPercent: 5, gross: 330, discount: 33, taxable: 297, tax: 14.85, net: 311.85 }
    ]
  });
});

test('invoice figures match ledger HSN rates and post-taxable discount for SAVE10', () => {
  const order = {
    id: 1001,
    coupon: 'SAVE10',
    total: 609.21,
    items: [
      { id: 8, name: 'Assam tea', hsn: '0902', price: 140, qty: 2 },
      { id: 2, name: 'Toor dal', hsn: '0713', price: 165, qty: 2 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 610);
  assert.equal(figures.tax, 60.21);
  assert.equal(figures.discount, 61);
  assert.equal(figures.cgst, 30.11);
  assert.equal(figures.sgst, 30.1);
  assert.equal(figures.total, 609.21);
});

test('invoice figures and rendered line GST match ledger for FLAT50', () => {
  const items = [
    { id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { id: 8, name: 'Assam tea', hsn: '0902', price: 140, qty: 1 }
  ];
  const ledger = pricing.computeTotals(items, 'FLAT50');
  const order = { id: 1002, coupon: 'FLAT50', total: ledger.total, tax: ledger.tax, subtotal: ledger.subtotal, discount: ledger.discount, items };
  const printedInvoice = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 49.35);
  assert.equal(ledger.total, 399.35);
  assert.equal(printedInvoice.tax, 49.35);
  assert.equal(printedInvoice.discount, 50);
  assert.equal(printedInvoice.total, 399.35);
  const html = invoice.render(order);
  assert.match(html, /12%<\/td><td class="r">₹27\.30<\/td>/);
  assert.match(html, /18%<\/td><td class="r">₹22\.05<\/td>/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('GST reconciliation matches ledger figures for in-memory orders', () => {
  const result = reports.getGstReconciliation({
    orders: [{
      id: 7,
      date: '01/01/2024',
      customer: 'Memory fixture',
      coupon: 'FLAT50',
      status: 'completed',
      subtotal: 400,
      discount: 50,
      tax: 49.35,
      total: 399.35,
      items: [
        { name: 'Butter', hsn: '0405', price: 260, qty: 1 },
        { name: 'Assam tea', hsn: '0902', price: 140, qty: 1 }
      ]
    }]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].invoiceTax, 49.35);
  assert.equal(result.rows[0].invoiceTotal, 399.35);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
