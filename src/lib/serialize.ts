import { Reservation } from '@prisma/client';

export interface SerializedReservation {
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

/**
 * Safely serializes a Prisma Reservation object (with relations)
 * to a plain, JSON-compatible object for safe Client Component passing.
 * Employs defensive fallback values if relations are missing.
 */
export function serializeReservation(reservation: any): SerializedReservation {
  if (!reservation) {
    throw new Error('Cannot serialize a null or undefined reservation.');
  }

  // Helper to safely format Date to ISO string
  const formatISO = (dateVal: any): string => {
    if (dateVal instanceof Date) {
      return dateVal.toISOString();
    }
    if (typeof dateVal === 'string') {
      return new Date(dateVal).toISOString();
    }
    return new Date().toISOString();
  };

  // Helper to safely format decimal price
  const formatPrice = (priceVal: any): string => {
    if (priceVal === null || priceVal === undefined) {
      return '0.00';
    }
    if (typeof priceVal === 'object' && typeof priceVal.toString === 'function') {
      return priceVal.toString();
    }
    if (typeof priceVal === 'number') {
      return priceVal.toFixed(2);
    }
    if (typeof priceVal === 'string') {
      return priceVal;
    }
    return '0.00';
  };

  return {
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: formatISO(reservation.expiresAt),
    createdAt: formatISO(reservation.createdAt),
    product: {
      id: reservation.product?.id || reservation.productId || '',
      name: reservation.product?.name || 'Unknown Product',
      price: formatPrice(reservation.product?.price),
    },
    warehouse: {
      id: reservation.warehouse?.id || reservation.warehouseId || '',
      name: reservation.warehouse?.name || 'Unknown Warehouse',
      location: reservation.warehouse?.location || 'Unknown Location',
    },
  };
}
