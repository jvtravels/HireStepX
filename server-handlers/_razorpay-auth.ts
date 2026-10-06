/* Shared Razorpay Basic-auth header construction — duplicated across every
 * handler that calls the Razorpay REST API directly (orders, subscriptions,
 * refunds). Centralized so the encoding is defined once. */

export function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}
