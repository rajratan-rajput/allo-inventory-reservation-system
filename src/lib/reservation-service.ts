import { prisma } from './prisma';
import { StockError, NotFoundError, ConflictError, ReservationExpiredError } from './errors';
import { Reservation, ReservationStatus } from '@prisma/client';

export interface ReservationWithRelations extends Reservation {
  product: {
    id: string;
    name: string;
    price: any;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export class ReservationService {
  /**
   * Safe reservation endpoint with SELECT FOR UPDATE row locking.
   * Ensures no concurrent requests can cause overselling.
   */
  static async createReservation(
    productId: string,
    warehouseId: string,
    quantity: number,
    idempotencyKey?: string
  ): Promise<ReservationWithRelations> {
    return await prisma.$transaction(async (tx) => {
      // 1. Optional Idempotency check
      if (idempotencyKey) {
        const cached = await tx.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (cached) {
          console.log(`[Idempotency] Cache hit for key: ${idempotencyKey}`);
          if (cached.responseCode >= 400) {
            const errData = JSON.parse(cached.responseBody);
            const err = new Error(errData.message);
            (err as any).status = cached.responseCode;
            (err as any).code = errData.code;
            throw err;
          }
          return JSON.parse(cached.responseBody) as ReservationWithRelations;
        }
      }

      // 2. Lock the Inventory row using raw SQL SELECT FOR UPDATE.
      // This blocks any other transactions trying to lock this same product-warehouse row.
      const inventoryRows = await tx.$queryRaw<any[]>`
        SELECT id, "productId", "warehouseId", "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      if (!inventoryRows || inventoryRows.length === 0) {
        throw new NotFoundError('Inventory record not found for this product in the selected warehouse.');
      }

      const inventory = inventoryRows[0];
      const availableStock = inventory.totalStock - inventory.reservedStock;

      console.log(
        `[Reservation attempt] Product: ${productId}, Warehouse: ${warehouseId}, Requested: ${quantity}, Total: ${inventory.totalStock}, Reserved: ${inventory.reservedStock}, Available: ${availableStock}`
      );

      // 3. Verify available stock
      if (availableStock < quantity) {
        throw new StockError(`Insufficient stock. Requested: ${quantity}, Available: ${availableStock}`);
      }

      // 4. Atomically update reserved stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: { increment: quantity },
        },
      });

      // 5. Create reservation record with 10-minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });

      // 6. Save response if idempotency key is present
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            responseCode: 201,
            responseBody: JSON.stringify(reservation),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour retention
          },
        });
      }

      return reservation as unknown as ReservationWithRelations;
    });
  }

  /**
   * Confirms a reservation (payment success).
   * Decrements physical stock and releases reserved stock.
   */
  static async confirmReservation(id: string): Promise<ReservationWithRelations> {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch reservation info first WITHOUT lock to get keys and check initial status
      const res = await tx.reservation.findUnique({
  where: { id },
  include: {
    product: {
      select: {
        id: true,
        name: true,
        price: true,
      },
    },
    warehouse: {
      select: {
        id: true,
        name: true,
        location: true,
      },
    },
  },
});

      if (!res) {
        throw new NotFoundError(`Reservation with ID ${id} not found.`);
      }

      if (res.status === 'CONFIRMED') {
        return res; // Idempotent success
      }

      if (res.status === 'RELEASED') {
        throw new ConflictError('This reservation has already been cancelled and released.');
      }

      if (res.status === 'EXPIRED') {
        throw new ReservationExpiredError();
      }

      // Check if it should be marked as expired based on clock
      const isExpired = Date.now() > res.expiresAt.getTime();

      // 2. Lock Inventory and Reservation in deterministic order to prevent deadlocks
      // ORDER: Inventory first, then Reservation
      
      // A. Lock Inventory
      const inventoryRows = await tx.$queryRaw<any[]>`
        SELECT id, "productId", "warehouseId", "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${res.productId} AND "warehouseId" = ${res.warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      if (!inventoryRows || inventoryRows.length === 0) {
        throw new NotFoundError('Inventory record not found for this reservation.');
      }
      const inventory = inventoryRows[0];

      // B. Lock Reservation
      const reservationRows = await tx.$queryRaw<any[]>`
        SELECT id, status, quantity
        FROM "Reservation"
        WHERE id = ${id}
        LIMIT 1
        FOR UPDATE
      `;
      if (!reservationRows || reservationRows.length === 0) {
        throw new NotFoundError('Reservation record not found during lock.');
      }
      const lockedRes = reservationRows[0];

      // Re-verify status under lock
      if (lockedRes.status !== 'PENDING') {
        if (lockedRes.status === 'CONFIRMED') return res;
        if (lockedRes.status === 'RELEASED') throw new ConflictError('This reservation has already been cancelled.');
        if (lockedRes.status === 'EXPIRED') throw new ReservationExpiredError();
      }

      // Handle expiration
      if (isExpired) {
        // Release the reservation stock
        const newReservedStock = Math.max(0, inventory.reservedStock - res.quantity);
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { reservedStock: newReservedStock },
        });

        // Set status to EXPIRED
        const updatedRes = await tx.reservation.update({
          where: { id },
          data: { status: 'EXPIRED' },
        });

        throw new ReservationExpiredError();
      }

      // 3. Finalize Stocks (Decrement totalStock and reservedStock)
      const newTotalStock = Math.max(0, inventory.totalStock - res.quantity);
      const newReservedStock = Math.max(0, inventory.reservedStock - res.quantity);

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalStock: newTotalStock,
          reservedStock: newReservedStock,
        },
      });

      // 4. Set reservation status to CONFIRMED
      const confirmedRes = await tx.reservation.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });

      console.log(`[Reservation confirmed] ID: ${id}, Quantity: ${res.quantity}, New Total Stock: ${newTotalStock}`);
      return confirmedRes as unknown as ReservationWithRelations;
    });
  }

  /**
   * Manually cancels/releases a pending reservation, returning stock to available.
   */
  static async releaseReservation(id: string): Promise<ReservationWithRelations> {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch reservation info first WITHOUT lock
      const res = await tx.reservation.findUnique({
        where: { id },
      });

      if (!res) {
        throw new NotFoundError(`Reservation with ID ${id} not found.`);
      }

      if (res.status === 'RELEASED') {
        return res; // Idempotent no-op
      }

      if (res.status === 'CONFIRMED') {
        throw new ConflictError('Cannot release a reservation that has already been purchased/confirmed.');
      }

      if (res.status === 'EXPIRED') {
        return res; // Idempotent no-op
      }

      const isExpired = Date.now() > res.expiresAt.getTime();

      // 2. Lock Inventory and Reservation in deterministic order (Inventory -> Reservation)
      
      // A. Lock Inventory
      const inventoryRows = await tx.$queryRaw<any[]>`
        SELECT id, "productId", "warehouseId", "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${res.productId} AND "warehouseId" = ${res.warehouseId}
        LIMIT 1
        FOR UPDATE
      `;

      if (!inventoryRows || inventoryRows.length === 0) {
        throw new NotFoundError('Inventory record not found for this reservation.');
      }
      const inventory = inventoryRows[0];

      // B. Lock Reservation
      const reservationRows = await tx.$queryRaw<any[]>`
        SELECT id, status, quantity
        FROM "Reservation"
        WHERE id = ${id}
        LIMIT 1
        FOR UPDATE
      `;
      if (!reservationRows || reservationRows.length === 0) {
        throw new NotFoundError('Reservation record not found during lock.');
      }
      const lockedRes = reservationRows[0];

      // Re-verify status under lock
      if (lockedRes.status !== 'PENDING') {
        return res; // Already handled by concurrent process
      }

      // 3. Release Reserved Stock (Decrement reservedStock)
      const newReservedStock = Math.max(0, inventory.reservedStock - res.quantity);
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: newReservedStock,
        },
      });

      // 4. Set reservation status
      const updatedStatus: ReservationStatus = isExpired ? 'EXPIRED' : 'RELEASED';
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: {
          status: updatedStatus,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });

      console.log(`[Reservation released] ID: ${id}, Status set to: ${updatedStatus}, Returned quantity: ${res.quantity}`);
      return updatedRes as unknown as ReservationWithRelations;
    });
  }

  /**
   * Cron job execution logic to sweep and expire all pending reservations in the past.
   * Processes each reservation in a separate transaction to avoid large lock escalations.
   */
  static async cleanupExpiredReservations(): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    details: string[];
  }> {
    // 1. Fetch pending expired items in batches
    const expiredPending = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      take: 100, // Batch limit per cron run
    });

    const results = {
      attempted: expiredPending.length,
      succeeded: 0,
      failed: 0,
      details: [] as string[],
    };

    if (expiredPending.length === 0) {
      return results;
    }

    console.log(`[Cron Cleanup] Found ${expiredPending.length} expired pending reservations. Initiating release batch...`);

    // 2. Loop and process each reservation in a separate, isolated transaction
    for (const res of expiredPending) {
      try {
        await prisma.$transaction(async (tx) => {
          // Lock Inventory first
          const inventoryRows = await tx.$queryRaw<any[]>`
            SELECT id, "productId", "warehouseId", "totalStock", "reservedStock"
            FROM "Inventory"
            WHERE "productId" = ${res.productId} AND "warehouseId" = ${res.warehouseId}
            LIMIT 1
            FOR UPDATE
          `;

          if (inventoryRows && inventoryRows.length > 0) {
            const inventory = inventoryRows[0];
            const newReservedStock = Math.max(0, inventory.reservedStock - res.quantity);
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { reservedStock: newReservedStock },
            });
          }

          // Lock and update reservation to EXPIRED
          await tx.reservation.update({
            where: { id: res.id },
            data: { status: 'EXPIRED' },
          });
        });

        results.succeeded++;
        results.details.push(`SUCCESS: Reservation ${res.id} expired. Released quantity ${res.quantity}.`);
      } catch (err: any) {
        results.failed++;
        results.details.push(`FAILED: Reservation ${res.id} cleanup encountered error: ${err.message}`);
        console.error(`[Cron Cleanup Error] Reservation ${res.id}:`, err);
      }
    }

    console.log(`[Cron Cleanup Finished] Attempted: ${results.attempted}, Succeeded: ${results.succeeded}, Failed: ${results.failed}`);
    return results;
  }
}
