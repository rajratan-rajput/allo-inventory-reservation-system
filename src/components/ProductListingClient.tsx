'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  MapPin, 
  Layers, 
  Loader2, 
  Search, 
  ChevronRight, 
  ShoppingBag,
  Info
} from 'lucide-react';

export interface ProductInventory {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price: string;
  inventories: ProductInventory[];
}

interface ProductListingClientProps {
  initialProducts: ProductData[];
}

export default function ProductListingClient({ initialProducts }: ProductListingClientProps) {
  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState<Record<string, string>>({}); // { productId: warehouseId }
  const [quantities, setQuantities] = useState<Record<string, number>>({}); // { productId: quantity }
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const { success, error, info } = useToast();
  const router = useRouter();

  // Handle setting default warehouse for each product on load
  React.useEffect(() => {
    const defaults: Record<string, string> = {};
    const defaultQuants: Record<string, number> = {};
    
    initialProducts.forEach((p) => {
      // Pick first warehouse with stock, or just the first available warehouse
      const withStock = p.inventories.find((inv) => inv.availableStock > 0);
      const chosen = withStock || p.inventories[0];
      if (chosen) {
        defaults[p.id] = chosen.warehouseId;
        defaultQuants[p.id] = 1;
      }
    });
    
    setSelectedWarehouses(defaults);
    setQuantities(defaultQuants);
  }, [initialProducts]);

  // Filter products by search query
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWarehouseChange = (productId: string, warehouseId: string) => {
    setSelectedWarehouses((prev) => ({ ...prev, [productId]: warehouseId }));
    setQuantities((prev) => ({ ...prev, [productId]: 1 })); // Reset quantity to 1 when warehouse changes
  };

  const handleQuantityChange = (productId: string, val: number, max: number) => {
    const clamped = Math.max(1, Math.min(val, max));
    setQuantities((prev) => ({ ...prev, [productId]: clamped }));
  };

  // Safe reserve click utilizing PostgreSQL locks + client-side idempotency
  const handleReserve = async (productId: string) => {
    const warehouseId = selectedWarehouses[productId];
    const quantity = quantities[productId] || 1;

    if (!warehouseId) {
      error('Please select a warehouse first.');
      return;
    }

    setLoadingProductId(productId);
    info('Securing inventory reservation lock...', 'Database Lock');

    try {
      // 1. Generate client-side idempotency key for this reservation attempt
      const idempotencyKey = crypto.randomUUID();

      // 2. Fire request
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity,
        }),
      });

      const resBody = await response.json();

      if (!response.ok) {
        // Trigger error message from backend (such as 409 Conflict)
        const errMsg = resBody.error?.message || 'Failed to create reservation.';
        const errCode = resBody.error?.code || 'UNKNOWN_ERROR';
        error(`${errMsg} (Code: ${errCode})`, 'Reservation Rejected');
        
        // Refresh local view of product stocks
        await refreshInventory();
        return;
      }

      const reservation = resBody.data;
      success(`Successfully reserved ${quantity} unit(s). Redirecting to checkout...`, 'Stock Reserved');
      
      // 3. Navigate to details page
      router.push(`/checkout/${reservation.id}`);
    } catch (err: any) {
      error(err.message || 'A network error occurred while establishing reservation.');
    } finally {
      setLoadingProductId(null);
    }
  };

  const refreshInventory = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error('Failed to auto-refresh inventory stock counts:', err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl flex-1 flex flex-col gap-8 animate-slide-in">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-900">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Multi-Warehouse Stock Catalog
          </h1>
          <p className="text-zinc-400 text-sm max-w-2xl">
            Simulate high concurrent checkouts. This page updates live and guarantees transactional integrity. Select a warehouse, input quantity, and reserve.
          </p>
        </div>

        {/* Dynamic search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all duration-150"
          />
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-white font-bold">No products found</h3>
          <p className="text-zinc-500 text-xs mt-1">Try refining your search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProducts.map((p) => {
            const selectedWId = selectedWarehouses[p.id] || '';
            const activeInventory = p.inventories.find((inv) => inv.warehouseId === selectedWId);
            const availableStock = activeInventory?.availableStock ?? 0;
            const chosenQuantity = quantities[p.id] || 1;

            let badgeColor = '';
            let badgeText = '';

            if (availableStock === 0) {
              badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              badgeText = 'Out of Stock';
            } else if (availableStock < 5) {
              badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              badgeText = `Low Stock: ${availableStock} left`;
            } else {
              badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              badgeText = `In Stock: ${availableStock} units`;
            }

            return (
              <div 
                key={p.id} 
                className="flex flex-col rounded-2xl border border-zinc-900 bg-zinc-900/20 hover:border-zinc-800 hover:bg-zinc-900/40 p-6 transition-all duration-200"
              >
                {/* Title and Price */}
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors">
                    {p.name}
                  </h3>
                  <span className="text-lg font-extrabold text-indigo-400">
                    ${parseFloat(p.price).toFixed(2)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-zinc-400 text-xs leading-relaxed mb-6 flex-1">
                  {p.description}
                </p>

                {/* Select Warehouse Form */}
                <div className="space-y-4 pt-4 border-t border-zinc-900/60">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Select Warehouse Location
                    </label>
                    <select
                      value={selectedWId}
                      onChange={(e) => handleWarehouseChange(p.id, e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      {p.inventories.map((inv) => (
                        <option key={inv.warehouseId} value={inv.warehouseId}>
                          {inv.warehouseName} ({inv.warehouseLocation}) — Stock: {inv.availableStock} available
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stock Status & Quantity Selection */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Dynamic stock level badge */}
                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${badgeColor}`}>
                      {badgeText}
                    </div>

                    {/* Quantity selectors */}
                    {availableStock > 0 && (
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                        <button
                          onClick={() => handleQuantityChange(p.id, chosenQuantity - 1, availableStock)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-bold text-sm"
                          disabled={chosenQuantity <= 1}
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-white">
                          {chosenQuantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(p.id, chosenQuantity + 1, availableStock)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-bold text-sm"
                          disabled={chosenQuantity >= availableStock}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleReserve(p.id)}
                    disabled={availableStock === 0 || loadingProductId !== null}
                    className={`w-full py-3 rounded-xl font-semibold text-xs tracking-wide uppercase flex items-center justify-center gap-1.5 transition-all duration-200 ${
                      availableStock === 0
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    {loadingProductId === p.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Locking Unit...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Secure Stock Reservation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Educational Banner */}
      <div className="mt-8 p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/30 flex gap-3 text-xs text-indigo-300">
        <Info className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-white">Inventory Protection</h4>
          <p className="leading-relaxed text-indigo-200/80">
            Atomic inventory reservation with concurrency-safe stock handling.
          </p>
        </div>
      </div>
    </div>
  );
}
