import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess } from '@/lib/errors';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventories: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Format output cleanly and map decimals/availableStock
    const formattedProducts = products.map((prod) => ({
      id: prod.id,
      name: prod.name,
      description: prod.description,
      price: prod.price.toString(), // Convert Decimal to string
      createdAt: prod.createdAt,
      updatedAt: prod.updatedAt,
      inventories: prod.inventories.map((inv) => ({
        id: inv.id,
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        warehouseLocation: inv.warehouse.location,
        totalStock: inv.totalStock,
        reservedStock: inv.reservedStock,
        availableStock: Math.max(0, inv.totalStock - inv.reservedStock),
      })),
    }));

    return apiSuccess(formattedProducts);
  } catch (error) {
    return handleApiError(error);
  }
}
