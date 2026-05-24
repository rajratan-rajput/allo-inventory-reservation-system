import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  // 1. Clean out existing database records in proper dependency order
  console.log('Cleaning existing data...');
  await prisma.idempotencyKey.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log('Seeding warehouses...');
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: 'Seattle Fulfilment Center',
        location: 'Seattle, WA, USA',
      },
    }),
    prisma.warehouse.create({
      data: {
        name: 'New York Depot',
        location: 'Brooklyn, NY, USA',
      },
    }),
    prisma.warehouse.create({
      data: {
        name: 'Frankfurt Hub',
        location: 'Frankfurt, Germany',
      },
    }),
  ]);

  const [seattle, newYork, frankfurt] = warehouses;
  console.log(`Seeded ${warehouses.length} warehouses.`);

  console.log('Seeding products...');
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Apex Mechanical Keyboard',
        description: 'Compact 75% mechanical keyboard with hot-swappable tactile switches and dynamic RGB backlighting.',
        price: 129.99,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Swift Wireless Mouse',
        description: 'Ultra-lightweight ergonomic wireless mouse with 26k DPI sensor and 80-hour battery life.',
        price: 79.50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Quantum 34" Curved Monitor',
        description: '34-inch ultra-wide QHD curved gaming monitor with 144Hz refresh rate and HDR400 support.',
        price: 499.00,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Ergo Throne Office Chair',
        description: 'Premium ergonomic office chair with mesh back, adjustable lumbar support, and 4D armrests.',
        price: 349.99,
      },
    }),
  ]);

  const [keyboard, mouse, monitor, chair] = products;
  console.log(`Seeded ${products.length} products.`);

  console.log('Seeding inventories per product per warehouse...');
  
  // Define inventory quantities for each product across warehouses
  const inventoriesToCreate = [
    // Seattle Stocks
    { productId: keyboard.id, warehouseId: seattle.id, totalStock: 45, reservedStock: 0 },
    { productId: mouse.id, warehouseId: seattle.id, totalStock: 60, reservedStock: 0 },
    { productId: monitor.id, warehouseId: seattle.id, totalStock: 15, reservedStock: 0 },
    { productId: chair.id, warehouseId: seattle.id, totalStock: 1, reservedStock: 0 }, // Exactly 1 item left in Seattle! Perfect for testing concurrency.

    // New York Stocks
    { productId: keyboard.id, warehouseId: newYork.id, totalStock: 20, reservedStock: 0 },
    { productId: mouse.id, warehouseId: newYork.id, totalStock: 35, reservedStock: 0 },
    { productId: monitor.id, warehouseId: newYork.id, totalStock: 4, reservedStock: 0 }, // Low Stock test (availableStock = 4)
    { productId: chair.id, warehouseId: newYork.id, totalStock: 10, reservedStock: 0 },

    // Frankfurt Stocks (simulate EU specific availability)
    { productId: keyboard.id, warehouseId: frankfurt.id, totalStock: 0, reservedStock: 0 }, // Out of stock test (availableStock = 0)
    { productId: mouse.id, warehouseId: frankfurt.id, totalStock: 50, reservedStock: 0 },
    { productId: monitor.id, warehouseId: frankfurt.id, totalStock: 8, reservedStock: 0 },
    { productId: chair.id, warehouseId: frankfurt.id, totalStock: 12, reservedStock: 0 },
  ];

  await Promise.all(
    inventoriesToCreate.map((inv) =>
      prisma.inventory.create({
        data: inv,
      })
    )
  );

  console.log(`Seeded inventories for all warehouses.`);
  console.log('--- Database Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
