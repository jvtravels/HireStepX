-- 0043: indexes for the admin employer-financials panel and the unlock-order
-- health checks. The existing idx_unlock_orders_open is partial (created/paid
-- only); the health check also reads failed/partial, and financials scans
-- payments by created_at across all employers.
create index if not exists idx_employer_unlock_payments_created
  on public.employer_unlock_payments (created_at);
create index if not exists idx_unlock_orders_status_created
  on public.employer_unlock_orders (status, created_at);
