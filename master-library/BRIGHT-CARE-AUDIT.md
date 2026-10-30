# Bright Care admin resource audit

Checked the uploaded original source and its running local admin on 2026-10-30.

The original `AdminDashboard.tsx` defines nine tabs. All nine rendered in the browser: Orders, Products & inventory, Homepage banners, Customer reviews, Delivery charges, Courier API, Tracking & pixels, Store settings, and Supabase/schema information. The library exposes matching admin links.

The source initializes products, categories and orders as empty arrays in `src/data/mockData.ts`. The running demo has zero products/orders/banners, two source-provided reviews and three delivery zones. Empty lists therefore do not indicate missing admin components. No records were added or removed during this read-only audit.

This source does not define a separate analytics dashboard, customer-list tab or reports tab like the Muba admin. Categories are managed inside Products & inventory. Source-specific settings include branding/logo, delivery offers, flash-sale end time, courier configuration, pixels and review management.

The demo uses browser-local storage, not the original remote Supabase database. Existing remote inventory, orders, banners and customers are consequently not imported. Courier credentials and tracking IDs are unset; real integrations need their backend/account configuration. The source's database-wide save descriptions apply to its Supabase deployment, not synchronization across browsers in this local demo.

A library navigation bug was also corrected: changing `#site=...&mode=admin` now switches the displayed portal rather than leaving the previous site's admin visible.
