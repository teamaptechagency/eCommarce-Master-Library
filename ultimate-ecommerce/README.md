# Ultimate Ecommarce By Astrallab

Local ecommerce platform using the supplied websites' actual source layouts and one canonical demo database.

- Storefront: http://127.0.0.1:8200/
- Original admin, passwordless demo: http://127.0.0.1:8200/demo
- Layouts, color packs and shared management: http://127.0.0.1:8201/demo?next=/admin/themes

Double-click Start-UltimateEcommerce.cmd. The launcher starts the gateway, control panel, local database services and six native engines. Services bind to loopback.

## Actual source layouts

| Layout | Original source | Renderer |
| --- | --- | --- |
| Shopperzz | E-commerce-6/local-app/shopperzz | Original Vue bundle, Blade shell and admin |
| Nest | E-commerce-14/local-app | Original Botble/Nest Blade theme and admin |
| Shofy | E-commerce-25/local-app | Original Botble/Shofy Blade theme and admin |
| GroStore | E-commerce-19/local-app | Original frontend/backend Blade views |
| MartVill / Othoba | E-commerce-2/local-app | Original CMS blocks, templates and admin |
| Footstep / সোহাগ অনলাইন | E:/Tawhid/public_html | Original React app and Laravel API |

data/native-engines contains independent copies of application code, templates and public files. Vendor dependencies use junctions. Each copy has separate environment configuration, bootstrap cache, sessions, storage and MySQL schema. Existing source websites and their databases remain separate.

The manifest verifies 2,506 template/component files against their original SHA-256 hashes. Run node native/verify-source-files.mjs to check the files actually used by the engines. The gateway adjusts local asset URLs, branding and color styles; the native engines render the original layouts.

Frontend/backend layout selection is independent. Their names appear in the admin library. The public storefront has no added theme selector or theme-library title. The original admin has a Layouts & colors link. Twelve built-in packs, reusable custom packs, and Light/Dark/Night modes are separate from layout selection.

## Shared data and feature scope

The authoritative database is data/ultimate.sqlite. The current demo has twelve published products, one draft product and nineteen orders. Historical guest buyers have consistent customer identities. Photos come from the supplied assets.

The snapshot adapter projects products, categories, brands, customers, orders and stock into owned native schemas. Native routes keep their framework validation and authentication. The bridge compares native records with their baseline and writes changed shared fields back. New native IDs receive mappings to canonical IDs.

Each original engine retains its routes, admin navigation and installed features. Plugin configuration, custom CMS blocks, secondary media, advanced variants and specialized workflow records still belong to their engine; they are not all interchangeable across engines. The shared control panel also retains its 39 modules, POS, inventory, reports, imports/exports and roles. This integration does not claim that every original plugin has been rewritten into one common backend.

The gateway serializes native commerce requests and checks schema ownership. Source-specific workflows need additional scenario coverage before production use. No live payment, courier, email or SMS services have been configured by this work.

## Runtime and data

Node.js 24 runs the gateway, SQLite store and control panel. XAMPP PHP/MySQL run five sources; the existing PHP 8.4 and MariaDB 3308 run Footstep. The gateway uses 8200, control uses 8201 and native engines use 8301/8302/8306/8314/8319/8325. Owned schemas are named astrallab_source_<layout>_20261029.

data is private and ignored by Git. Back up the canonical database, encryption.key, native schemas, identity mappings, and native storage/uploads together. Logs and native-verification.json are in data. The old Master Library on 8090 remains independent.

## Verification

    node --test test/*.test.mjs
    node native/verify-source-files.mjs
    node native/verify-native.mjs
    node native/verify-sync.mjs

The native check covers six public/admin responses, CSS/JS assets and catalog APIs. The sync check temporarily edits a product using the original Footstep admin API, confirms it in the original Nest catalog, and restores its name. HTTP checks do not replace visual browser review; browser automation was unavailable during this correction.
