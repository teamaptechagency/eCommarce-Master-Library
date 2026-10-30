# Local ecommerce previews

Verified homepage HTTP 200 on 2026-10-29:

| Folder | Site | URL |
|---|---|---|
| E-commerce-2 | MartVill / Othoba | http://127.0.0.1:8002 |
| E-commerce-6 | Shopperzz | http://127.0.0.1:8006 |
| E-commerce-14 | Nest | http://127.0.0.1:8014 |
| E-commerce-19 | GroStore | http://127.0.0.1:8019 |
| E-commerce-25 | Shofy | http://127.0.0.1:8025 |

E-commerce-18 contains no source archive. E-commerce-9's PHP server is on port 8009, but its storefront fails because the base database is missing. Its installer expects `installation/backup/database.sql`; the bundled update migrations cannot create that base schema.

Original archives remain intact. Extracted applications live in each folder's `local-app` directory (Shopperzz has an additional `shopperzz` directory).

Run `./run-local.ps1` from PowerShell to start the PHP servers again. They require XAMPP PHP and MariaDB on port 3306. MariaDB was started separately during setup. Each app has a separate local database. GroStore uses `ecommerce_local_19_preview_20261029`; the earlier partial setup database was preserved.

Server output is saved as `server.stdout.log` and `server.stderr.log` in each site's folder. Nest's optional `local-seed.php` helper loads Faker from the bundled Shofy vendor directory. GroStore's `local-migrate.php` helper applies its migrations to legacy demo data with foreign key checks temporarily disabled for that connection.

Validation covers homepage responses. Checkout, payments, email, login, and all interactive features have not been tested.
