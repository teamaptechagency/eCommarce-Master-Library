# Commerce Master Library

Open **http://127.0.0.1:8090** after double-clicking `Start-MasterLibrary.cmd` in the parent folder. The launcher starts the library, both existing MariaDB runtimes and six separate PHP previews. No npm install or frontend build is required.

## Included websites

| Website | Preview | Admin |
|---|---|---|
| Footstep / সোহাগ অনলাইন | http://127.0.0.1:8101 | Admin Demo button |
| MartVill / Othoba | http://127.0.0.1:8102 | Admin Demo button |
| Shopperzz | http://127.0.0.1:8106 | Admin Demo button |
| Nest | http://127.0.0.1:8114 | Admin Demo button |
| GroStore | http://127.0.0.1:8119 | Admin Demo button |
| Shofy | http://127.0.0.1:8125 | Admin Demo button |

E-commerce-9 remains listed with its missing `installation/backup/database.sql` dependency. E-commerce-18 is listed as an empty folder. These entries do not pretend to have working portals.

Website cards retain project names and actual homepage titles. Search matches names, features, and discovered page paths. Favorites are stored in the browser. The workspace has an embedded portal, site switcher, public/admin switch, a searchable feature list, and an option to open the portal in a new tab. Parameterized pages ask for an ID or slug.

## Direct admin demo

Admin Demo signs into an existing local administrator account using the application's normal session guard or Sanctum token. Passwords and normal login controllers are unchanged. The router runs only in the dedicated local PHP preview processes; it does not add a permanent route to any source application.

The library and previews bind to `127.0.0.1`. Demo links are HMAC signed, expire after 60 seconds, and accept only local relative destinations. Session cookies have separate names for each app. SPA demo tokens expire after eight hours. The signing secret is generated on each library launch and stored in the ignored `data/runtime.json`; this directory is not served by the library. Do not deploy this local demo router to public hosting.

Preview HTML includes a return link to the library. Frame permissions are adjusted only in these local preview responses to allow the embedded workspace. Original application code, archives, passwords and databases are retained. Previews use the already configured databases; they are not disposable copies.

## Feature discovery

The PHP router reads each running application's registered GET routes. It does not instantiate every controller or visit those pages. Internal endpoints and obvious mutation/payment handlers are filtered out. Vue route source supplies Shopperzz pages; deployed React routes and admin tab state supply Footstep pages. Feature discovery provides navigation, not a guarantee that every legacy feature works. Refresh updates both status and the page catalog.

## Files and maintenance

- `sites.mjs`: site names, app paths, PHP versions, categories and preview ports.
- `server.mjs`: launcher/orchestration and the local library server.
- `router.php`: local PHP front controller and signed demo login.
- `route-catalog.php`: page discovery filter.
- `public/`: buildless interface.
- `data/`: ignored runtime configuration, cached route lists, logs and verification output.

The collection uses XAMPP PHP 8.2 for the six archive apps and `E:/Tawhid/runtime/php/php.exe` for Footstep. MariaDB ports are 3306 and 3308; the latter reuses the existing runtime configured in `E:/Tawhid/start-site.ps1`. The original 8001/8002/8006/8014/8019/8025 previews can continue running independently.

Run `node master-library/verify.mjs` from the parent folder while the launcher is running to check native admin sessions and SPA demo handoffs. Browser validation also covers the rendered Footstep and Shopperzz dashboards. Live payments, sending email, changing business records and every individual legacy feature have not been tested.

## Shopperzz storefront repair

The initial install had an empty demo catalog (`DEMO=false`), so the frontend rendered only its header and footer. The local preview now contains 11 bundled sample products with variations and stock, 45 categories, 8 brands, 3 sliders, promotions and footer pages. Existing users and login settings were retained. `repair-shopperzz.php` checks the isolated `ecommerce_local_6` database and fills only empty demo tables; it does not reset them. Demo mode is restored after importing content.

The missing `public/storage` junction was restored. The library router explicitly permits media files resolved through that junction into `storage/app/public`, while private application paths remain blocked. Both stylesheets were verified as CSS responses, and the rendered homepage had no broken images. The install prompt is disabled in the Vue source and in the bootstrap for the existing compiled bundle. The API base URL follows the current preview origin, and the local debug toolbar is disabled.

## Nest and Shofy admin repair

Their admin CSS and JavaScript live under `public/vendor`. These public assets are allowed by the preview router; private root-level Composer `vendor` paths remain blocked. Both apps initialize a session store named `botble_session` during provider boot. The preview now renames the already initialized store as well as overriding its configuration, so switching between the apps retains separate login sessions.

Shofy's `storage/app/purifier` cache folder was restored and its Windows read-only flag cleared. Without this, product table AJAX returned an exception even though the dashboard itself loaded. The regression check verifies that both product grids return actual rows without a server-side error (Nest: 24 products; Shofy: 57 products).

Run `node master-library/verify-botble.mjs` from the parent folder to check both logins with one shared browser-style cookie jar, subsequent product page access, public asset MIME types, and the private vendor restriction.
