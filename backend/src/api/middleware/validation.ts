import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Ethereum address validation regex
 */
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

/**
 * Common validation schemas
 */
export const schemas = {
  // Ethereum address validation
  ethereumAddress: z.string().regex(ethereumAddressRegex, 'Invalid Ethereum address'),

  // Pagination
  pagination: z.object({
    limit: z.string().optional().transform(val => {
      const num = parseInt(val || '20');
      return Math.min(Math.max(num, 1), 100); // Between 1 and 100
    }),
    offset: z.string().optional().transform(val => {
      const num = parseInt(val || '0');
      return Math.max(num, 0);
    }),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  }),

  // Days parameter (for metrics)
  days: z.string().optional().transform(val => {
    const num = parseInt(val || '30');
    return Math.min(Math.max(num, 1), 365); // Between 1 and 365
  }),

  // Market ID (bytes32 hash)
  marketId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid market ID format'),

  // Status filter
  status: z.enum(['pending', 'processed', 'failed']).optional(),

  // Severity filter
  severity: z.enum(['critical', 'warning', 'info']).optional(),
};

/**
 * Query parameter validation for reimbursements
 */
export const reimbursementQuerySchema = z.object({
  limit: z.string().optional().transform(val => Math.min(parseInt(val || '50'), 1000)),
  borrowerAddress: z.string().regex(ethereumAddressRegex).optional().or(z.literal('')),
  marketId: z.string().optional(),
  status: z.enum(['pending', 'processed', 'failed']).optional().or(z.literal('')),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Query parameter validation for alerts
 */
export const alertQuerySchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']).optional().or(z.literal('')),
  limit: z.string().optional().transform(val => Math.min(parseInt(val || '50'), 100)),
});

/**
 * Params validation for borrower routes
 */
export const borrowerParamsSchema = z.object({
  address: z.string().regex(ethereumAddressRegex, 'Invalid Ethereum address'),
});

/**
 * Middleware factory for validating request data
 */
export function validate<T extends z.ZodSchema>(
  schema: T,
  source: 'query' | 'params' | 'body' = 'query'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
      const result = schema.safeParse(data);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation Error',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      // Replace the original data with validated and transformed data
      if (source === 'query') {
        req.query = result.data as any;
      } else if (source === 'params') {
        req.params = result.data as any;
      } else {
        req.body = result.data;
      }

      next();
    } catch (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
      });
    }
  };
}

/**
 * Validate Ethereum address helper
 */
export function isValidAddress(address: string): boolean {
  return ethereumAddressRegex.test(address);
}

/**
 * Normalize Ethereum address to lowercase with checksum
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}
