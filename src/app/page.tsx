import { prisma } from '@/lib/prisma';
import ProductListingClient, { ProductData } from '@/components/ProductListingClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Query products directly from the database in a Server Component
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

  // Format to standard UI models, converting Decimal to String
  const formattedProducts: ProductData[] = products.map((prod) => ({
    id: prod.id,
    name: prod.name,
    description: prod.description,
    price: prod.price.toString(),
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

  return <ProductListingClient initialProducts={formattedProducts} />;
}
