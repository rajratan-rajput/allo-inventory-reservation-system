import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { ReservationService } from '../lib/reservation-service';
import { StockError } from '../lib/errors';
import { config } from 'dotenv';

// Load environmental variables for local testing
beforeAll(() => {
  config();
});

describe('Inventory Reservation Integration & Concurrency Tests', () => {
  
  // Clean up database instances after testing
  const cleanUpTestData = async (productIds: string[], warehouseIds: string[]) => {
    try {
      await prisma.reservation.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.inventory.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
      await prisma.warehouse.deleteMany({
        where: { id: { in: warehouseIds } },
      });
    } catch (err) {
      console.error('[Test Clean Up Error]:', err);
    }
  };

  it('should execute a complete successful reservation, confirm, and balance cycle', async () => {
    // 1. Setup Test Product and Warehouse
    const product = await prisma.product.create({
      data: {
        name: 'Vitest Flow Keyboard',
        description: 'Test description',
        price: 99.99,
      },
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        name: 'Vitest Flow Warehouse',
        location: 'Test Location',
      },
    });

    // Seed stock of 10
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalStock: 10,
        reservedStock: 0,
      },
    });

    // 2. Reserve 3 items
    const reservation = await ReservationService.createReservation(
      product.id,
      warehouse.id,
      3
    );

    expect(reservation).toBeDefined();
    expect(reservation.status).toBe('PENDING');
    expect(reservation.quantity).toBe(3);

    // Verify stock hold in database (total: 10, reserved: 3, available: 7)
    let updatedInv = await prisma.inventory.findUnique({
      where: { id: inventory.id },
    });
    if (!updatedInv) throw new Error('Inventory record was not updated');
    expect(updatedInv.reservedStock).toBe(3);
    expect(updatedInv.totalStock - updatedInv.reservedStock).toBe(7);

    // 3. Confirm payment for the reserved items
    const confirmedRes = await ReservationService.confirmReservation(reservation.id);
    expect(confirmedRes.status).toBe('CONFIRMED');

    // Verify physical stock decrement (total: 7, reserved: 0, available: 7)
    updatedInv = await prisma.inventory.findUnique({
      where: { id: inventory.id },
    });
    if (!updatedInv) throw new Error('Inventory record was not updated after confirm');
    expect(updatedInv.totalStock).toBe(7);
    expect(updatedInv.reservedStock).toBe(0);

    // 4. Teardown test data
    await cleanUpTestData([product.id], [warehouse.id]);
  });

  it('should prevent race conditions: exactly 1 concurrent reservation succeeds when stock is 1', async () => {
    // 1. Setup Test Product and Warehouse
    const product = await prisma.product.create({
      data: {
        name: 'Vitest Concurrency Chair',
        description: 'Test description for race conditions',
        price: 299.99,
      },
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        name: 'Vitest Concurrency Warehouse',
        location: 'Race Track City',
      },
    });

    // Seed critical stock of exactly 1 item!
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalStock: 1,
        reservedStock: 0,
      },
    });

    // 2. Fire 10 concurrent requests to reserve that 1 unit
    console.log('[Vitest Concurrency] Spawning 10 concurrent stock hold transactions...');
    const concurrentRequests = Array.from({ length: 10 }).map(() =>
      ReservationService.createReservation(product.id, warehouse.id, 1)
    );

    const results = await Promise.allSettled(concurrentRequests);

    // 3. Analyze transaction resolutions
    const successes = results.filter((r) => r.status === 'fulfilled');
    const rejections = results.filter((r) => r.status === 'rejected');

    console.log(`[Vitest Concurrency Finished] Successes: ${successes.length}, Rejections: ${rejections.length}`);

    // EXACTLY 1 request must succeed. The other 9 MUST fail to prevent overselling.
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(9);

    // 4. Assert that failures failed with proper Stock Error messages (HTTP 409 equivalents)
    rejections.forEach((rej) => {
      const reason = (rej as PromiseRejectedResult).reason;
      expect(reason instanceof StockError || reason.message.includes('Insufficient stock')).toBe(true);
    });

    // 5. Assert final database consistency
    const finalInv = await prisma.inventory.findUnique({
      where: { id: inventory.id },
    });
    // Physically still has 1 unit, but it is 100% reserved (available = 0)
    expect(finalInv?.totalStock).toBe(1);
    expect(finalInv?.reservedStock).toBe(1);

    const activeReservations = await prisma.reservation.findMany({
      where: { productId: product.id, status: 'PENDING' },
    });
    expect(activeReservations.length).toBe(1);

    // 6. Teardown test data
    await cleanUpTestData([product.id], [warehouse.id]);
  });
});
