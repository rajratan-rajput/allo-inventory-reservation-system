import { ReservationService } from '@/lib/reservation-service';
import { handleApiError, apiSuccess } from '@/lib/errors';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function performCleanup(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Production security checking
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Cron Cleanup Unauthorized]: Access attempt rejected due to invalid token.');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized access. Valid Cron Authorization is required.',
          },
        },
        { status: 401 }
      );
    }

    const results = await ReservationService.cleanupExpiredReservations();

    return apiSuccess({
      message: 'Expired reservations sweep executed successfully.',
      ...results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  return performCleanup(req);
}

export async function POST(req: NextRequest) {
  return performCleanup(req);
}
