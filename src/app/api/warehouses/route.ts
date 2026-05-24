import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    return apiSuccess(warehouses);
  } catch (error) {
    return handleApiError(error);
  }
}
