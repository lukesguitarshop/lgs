'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PlatformConfig {
  label: string;
  feePercent: number;
  fixedFee: number;
}

function calcListPrice(purchasePrice: number, targetProfit: number, shippingCost: number, otherCosts: number, feePercent: number, fixedFee: number): number {
  // listPrice * (1 - feeRate) = purchasePrice + targetProfit + shippingCost + otherCosts + fixedFee
  const totalNeeded = purchasePrice + targetProfit + shippingCost + otherCosts + fixedFee;
  const rate = feePercent / 100;
  if (rate >= 1) return Infinity;
  return totalNeeded / (1 - rate);
}

export default function FlipCalculatorTab() {
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [targetProfit, setTargetProfit] = useState<string>('200');
  const [shippingCost, setShippingCost] = useState<string>('0');
  const [otherCosts, setOtherCosts] = useState<string>('0');

  // Reverb: 9.1% of total sale, no fixed fee
  const [reverbFeePercent, setReverbFeePercent] = useState<string>('9.1');
  const [reverbFixedFee, setReverbFixedFee] = useState<string>('0');

  // Stripe: 2.9% + $0.30
  const [stripeFeePercent, setStripeFeePercent] = useState<string>('2.9');
  const [stripeFixedFee, setStripeFixedFee] = useState<string>('0.30');

  // PayPal: 3.49% + $0.49
  const [paypalFeePercent, setPaypalFeePercent] = useState<string>('3.49');
  const [paypalFixedFee, setPaypalFixedFee] = useState<string>('0.49');

  const purchase = parseFloat(purchasePrice) || 0;
  const profit = parseFloat(targetProfit) || 0;
  const shipping = parseFloat(shippingCost) || 0;
  const other = parseFloat(otherCosts) || 0;

  const platforms: (PlatformConfig & { setFeePercent: (v: string) => void; setFixedFee: (v: string) => void; feePercentStr: string; fixedFeeStr: string })[] = [
    {
      label: 'Reverb',
      feePercent: parseFloat(reverbFeePercent) || 0,
      fixedFee: parseFloat(reverbFixedFee) || 0,
      feePercentStr: reverbFeePercent,
      fixedFeeStr: reverbFixedFee,
      setFeePercent: setReverbFeePercent,
      setFixedFee: setReverbFixedFee,
    },
    {
      label: 'Stripe',
      feePercent: parseFloat(stripeFeePercent) || 0,
      fixedFee: parseFloat(stripeFixedFee) || 0,
      feePercentStr: stripeFeePercent,
      fixedFeeStr: stripeFixedFee,
      setFeePercent: setStripeFeePercent,
      setFixedFee: setStripeFixedFee,
    },
    {
      label: 'PayPal',
      feePercent: parseFloat(paypalFeePercent) || 0,
      fixedFee: parseFloat(paypalFixedFee) || 0,
      feePercentStr: paypalFeePercent,
      fixedFeeStr: paypalFixedFee,
      setFeePercent: setPaypalFeePercent,
      setFixedFee: setPaypalFixedFee,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Shared Inputs */}
      <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#020E1C] mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#6E0114]" />
          Flip Calculator
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumberInput label="Purchase Price" value={purchasePrice} onChange={setPurchasePrice} prefix="$" placeholder="0.00" />
          <NumberInput label="Target Profit" value={targetProfit} onChange={setTargetProfit} prefix="$" placeholder="200" />
          <NumberInput label="Shipping Cost" value={shippingCost} onChange={setShippingCost} prefix="$" placeholder="0.00" />
          <NumberInput label="Other Costs" value={otherCosts} onChange={setOtherCosts} prefix="$" placeholder="0.00" />
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms.map((p) => {
          const listPrice = calcListPrice(purchase, profit, shipping, other, p.feePercent, p.fixedFee);
          const fees = listPrice * (p.feePercent / 100) + p.fixedFee;
          const actualProfit = listPrice - purchase - shipping - other - fees;

          return (
            <div key={p.label} className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-5">
              <h4 className="text-base font-semibold text-[#020E1C] mb-3">{p.label}</h4>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <NumberInput label="Fee %" value={p.feePercentStr} onChange={p.setFeePercent} suffix="%" compact />
                <NumberInput label="Fixed Fee" value={p.fixedFeeStr} onChange={p.setFixedFee} prefix="$" compact />
              </div>

              {purchase > 0 ? (
                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <ResultRow label="List At" value={formatCurrency(listPrice)} highlight />
                  <ResultRow label="Platform Fees" value={formatCurrency(fees)} muted />
                  <ResultRow label="Net Profit" value={formatCurrency(actualProfit)} success />
                </div>
              ) : (
                <p className="text-sm text-gray-400 pt-3 border-t border-gray-200">Enter a purchase price to calculate</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <label className={`block text-gray-500 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</label>
      <div className="relative">
        {prefix && (
          <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md bg-white text-[#020E1C] focus:outline-none focus:ring-2 focus:ring-[#6E0114]/30 focus:border-[#6E0114] ${
            compact ? 'text-sm py-1.5' : 'py-2'
          } ${prefix ? 'pl-6' : 'pl-3'} ${suffix ? 'pr-7' : 'pr-3'}`}
        />
        {suffix && (
          <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight, muted, success }: { label: string; value: string; highlight?: boolean; muted?: boolean; success?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span
        className={`font-semibold ${
          highlight ? 'text-lg text-[#6E0114]' : success ? 'text-green-700' : muted ? 'text-gray-500 text-sm' : 'text-[#020E1C]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
