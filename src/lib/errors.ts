import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class AppError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class StockError extends AppError {
  constructor(message = 'Insufficient available stock for the requested quantity.') {
    super(message, 'INSUFFICIENT_STOCK', 409);
  }
}

export class ReservationExpiredError extends AppError {
  constructor(message = 'This reservation has expired and the stock has been released.') {
    super(message, 'RESERVATION_EXPIRED', 410);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request payload.') {
    super(message, 'INVALID_REQUEST', 400);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'A conflict occurred with the current state of the resource.') {
    super(message, 'CONFLICT', 409);
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('[API Error Handled]:', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed.',
          details: error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // Handle default unexpected errors
  const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
    },
    { status: 500 }
  );
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}
