import { describe, it, expect } from 'vitest';
import axios from 'axios';

describe('Clerk API Keys Validation', () => {
  it('should validate CLERK_SECRET_KEY by calling Clerk API', async () => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    expect(secretKey).toBeDefined();
    expect(secretKey).toMatch(/^sk_test_/);

    try {
      // Clerk API call to list users (lightweight check)
      const response = await axios.get('https://api.clerk.com/v1/users', {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });
      expect(response.status).toBe(200);
    } catch (error: any) {
      console.error('Clerk API Validation Failed:', error.response?.data || error.message);
      throw new Error(`Clerk API key validation failed: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  });

  it('should check VITE_CLERK_PUBLISHABLE_KEY format', () => {
    const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
    expect(publishableKey).toBeDefined();
    expect(publishableKey).toMatch(/^pk_test_/);
  });
});
