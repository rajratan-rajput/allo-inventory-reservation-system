'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowLeft, 
  Loader2, 
  MapPin, 
  Package, 
  CreditCard,
  Printer
} from 'lucide-react';
import Link from 'next/link';

export interface CheckoutReservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    price: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

interface CheckoutClientProps {
  initialReservation: CheckoutReservation;
}

export default function CheckoutClient({ initialReservation }: CheckoutClientProps) {
  const [reservation, setReservation] = useState<CheckoutReservation>(initialReservation);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const { success, error, warning } = useToast();
  const router = useRouter();

  // 1. Live Countdown Timer synchronized withexpiresAt from server
  useEffect(() => {
    // If the reservation is already finalized, don't run the timer
    if (reservation.status !== 'PENDING') return;

    const expiresTime = new Date(reservation.expiresAt).getTime();

    const calculateTimeLeft = () => {
      const difference = expiresTime - Date.now();
      return Math.max(0, Math.floor(difference / 1000));
    };

    // Set initial remaining time
    const initialTime = calculateTimeLeft();
    setTimeLeft(initialTime);

    if (initialTime <= 0) {
      setReservation((prev) => ({ ...prev, status: 'EXPIRED' }));
      return;
    }

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        setReservation((prev) => ({ ...prev, status: 'EXPIRED' }));
        warning('Your reservation window has expired. Stock has been returned to inventory.', 'Reservation Expired');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation.expiresAt, reservation.status, warning]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 2. Fetch latest reservation state to check for async updates (optional helper)
  const syncState = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`);
      const data = await res.json();
      if (data.success) {
        setReservation(data.data);
      }
    } catch (err) {
      console.error('Failed to sync reservation status:', err);
    }
  }, [reservation.id]);

  // 3. Confirm Purchase handler
  const handleConfirm = async () => {
    if (reservation.status !== 'PENDING') return;

    setIsConfirming(true);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST',
      });

      const body = await response.json();

      if (!response.ok) {
        const errMsg = body.error?.message || 'Failed to confirm purchase.';
        error(errMsg, 'Transaction Failed');
        
        // Expiry edge cases (status 410)
        if (response.status === 410) {
          setReservation((prev) => ({ ...prev, status: 'EXPIRED' }));
        } else {
          await syncState();
        }
        return;
      }

      success('Payment captured! Your stock has been secured permanently.', 'Purchase Successful');
      setReservation(body.data.reservation);
    } catch (err: any) {
      error(err.message || 'An error occurred during payment capture.');
    } finally {
      setIsConfirming(false);
    }
  };

  // 4. Cancel / Release Reservation handler
  const handleCancel = async () => {
    if (reservation.status !== 'PENDING') return;

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST',
      });

      const body = await response.json();

      if (!response.ok) {
        const errMsg = body.error?.message || 'Failed to release reservation.';
        error(errMsg, 'Cancellation Failed');
        await syncState();
        return;
      }

      success('Reservation cancelled. Returning to inventory.', 'Reservation Released');
      router.push('/');
    } catch (err: any) {
      error(err.message || 'An error occurred during reservation release.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Price calculations
  const price = parseFloat(reservation?.product?.price || "0");
  const total = price * reservation.quantity;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl flex-1 flex flex-col justify-center animate-slide-in">
      <Link 
        href="/"
        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-semibold uppercase tracking-wider mb-6 self-start group transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Back to Products Catalog
      </Link>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 shadow-2xl p-6 md:p-8 flex flex-col gap-6">
        
        {/* Reservation Status Banners */}
        {reservation.status === 'PENDING' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Temporary Stock Hold Locked</h4>
                <p className="text-[10px] text-indigo-300/80 font-medium">Checkout is open. Complete within the window.</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl self-start md:self-auto">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mr-1">Time Left:</span>
              <span className="font-mono text-lg font-bold text-indigo-400 tracking-tight">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        )}

        {reservation.status === 'CONFIRMED' && (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white text-sm">Purchase Confirmed!</h4>
              <p className="text-xs text-emerald-200/80 leading-relaxed mt-0.5">
                Transaction completed successfully. Physical stock has been permanently decremented from inventory. Your reservation is finalized.
              </p>
            </div>
          </div>
        )}

        {reservation.status === 'EXPIRED' && (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/30">
            <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white text-sm">Reservation Expired</h4>
              <p className="text-xs text-rose-200/80 leading-relaxed mt-0.5">
                The 10-minute hold window closed. The reserved stock was safely released and returned to the warehouse inventory to prevent dead locks. Please start a new checkout.
              </p>
            </div>
          </div>
        )}

        {reservation.status === 'RELEASED' && (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <AlertTriangle className="w-6 h-6 text-zinc-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-zinc-300 text-sm">Reservation Released</h4>
              <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
                This reservation has been cancelled manually. Held stocks were instantly returned back to active catalog.
              </p>
            </div>
          </div>
        )}

        {/* Order Details Card */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Reservation Overview</h3>
          
          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start gap-4 pb-4 border-b border-zinc-900">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-sm">{reservation.product.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">
                    Quantity: {reservation.quantity} unit(s) @ ${price.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-start gap-4">
              <div className="flex items-start gap-3 text-xs text-zinc-400">
                <MapPin className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-zinc-200">{reservation.warehouse.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{reservation.warehouse.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Price Invoice Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
            <span>Stock Reservation Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
            <span>Estimated Shipping & Fees</span>
            <span className="text-emerald-500 uppercase font-bold text-[10px] tracking-wide">Calculated free</span>
          </div>
          <div className="h-px bg-zinc-900 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-white">Grand Total</span>
            <span className="text-lg font-extrabold text-indigo-400">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Controls */}
        {reservation.status === 'PENDING' ? (
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-900/60">
            {/* Confirm Purchase */}
            <button
              onClick={handleConfirm}
              disabled={isConfirming || isCancelling}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Confirm Purchase</span>
                </>
              )}
            </button>

            {/* Cancel/Release Hold */}
            <button
              onClick={handleCancel}
              disabled={isConfirming || isCancelling}
              className="sm:w-44 border border-zinc-800 hover:bg-zinc-900 active:scale-[0.98] text-zinc-400 hover:text-white py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Cancel Reservation</span>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-900/60">
            <Link
              href="/"
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
            >
              Return to Catalog
            </Link>
            {reservation.status === 'CONFIRMED' && (
              <button
                onClick={() => window.print()}
                className="sm:w-44 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
