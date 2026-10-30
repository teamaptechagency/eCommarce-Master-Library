# eCommarce Master Library

A local workspace for browsing ecommerce storefronts and their original admin interfaces, plus **Ultimate Ecommarce By Astrallab**, a shared commerce demo and source-engine gateway.

## Start the library

Requires Node.js 24 or newer. The included React storefront runs without a remote database.

```powershell
cd master-library
npm ci
npm run setup:new
cd ..
.\Start-MasterLibrary.ps1
```

Open http://127.0.0.1:8090/. Public previews and signed, passwordless local admin demos are available from the cards. The retained React source uses its supplied browser-storage fallback with sample data; it does not connect to the original Supabase project.

The sidebar button hides/shows the library navigation and remembers the selection. Favorites, website search, feature navigation and direct public/admin views are included.

## Original source installations

The existing MartVill, Shopperzz, Nest, GroStore and Shofy integrations reference locally installed Laravel applications under `E-commerce-*/local-app`; Footstep references the existing local Footstep installation. These supplied third-party installations, their Composer dependencies, private configuration, original ZIP archives and business databases are external prerequisites and are not included in this source repository.

The library keeps unavailable sources listed with an explanation. The additional E-commerce-9 installation needs its original base database; E-commerce-18 has no application files; the supplied Ghorer Bazar ZIP has no React `src` directory. Duplicate archive entries and the additional Tuktak version were removed, retaining one runnable React source.

## Ultimate Ecommerce

See [ultimate-ecommerce/README.md](ultimate-ecommerce/README.md) for the shared product/order store, original source layouts, independent frontend/backend appearance, twelve color packs, custom packs and Light/Dark/Night modes.

Its native source gateway is on http://127.0.0.1:8200/ and requires the locally prepared source engines and owned projection databases. The shared management service is `ultimate-ecommerce/server.mjs`; native setup adapters are in `ultimate-ecommerce/native/`.

## Checks

```powershell
node --test ultimate-ecommerce/test/*.test.mjs
node --check master-library/server.mjs
node --check master-library/public/app.js
```

These applications are local demos bound to loopback. Runtime secrets, encryption keys, database files, logs, sessions, uploads, dependencies and generated builds are excluded from Git.
