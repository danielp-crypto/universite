'use client';

import { useState, FormEvent } from 'react';
import { apiPost } from '@/lib/api/client';

interface PayfastButtonProps {
  amount: number;
  itemName: string;
  itemDescription?: string;
  email?: string;
  userId?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function PayfastButton({
  amount,
  itemName,
  itemDescription,
  email,
  userId,
  className = '',
  children = 'Pay Now',
}: PayfastButtonProps) {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<Record<string, string> | null>(null);
  const [payfastUrl, setPayfastUrl] = useState<string>('');

  const handlePayNow = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await apiPost('/api/payments/payfast/checkout', {
        amount,
        item_name: itemName,
        item_description: itemDescription,
        email,
        user_id: userId,
      });

      if (result.success && result.payment_data) {
        setPaymentData(result.payment_data);
        setPayfastUrl(result.payfast_url);
        
        // Auto-submit the form after a short delay
        setTimeout(() => {
          const form = document.getElementById('payfast-form') as HTMLFormElement;
          form?.submit();
        }, 100);
      } else {
        console.error('Failed to generate checkout:', result.error);
        alert('Failed to initiate payment. Please try again.');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handlePayNow}
        disabled={loading}
        className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? 'Processing...' : children}
      </button>

      {/* Hidden PayFast form - auto-submitted when payment data is ready */}
      {paymentData && payfastUrl && (
        <form
          id="payfast-form"
          action={payfastUrl}
          method="POST"
          className="hidden"
        >
          {Object.entries(paymentData).map(([key, value]) => (
            <input
              key={key}
              type="hidden"
              name={key}
              value={value}
            />
          ))}
        </form>
      )}
    </>
  );
}
