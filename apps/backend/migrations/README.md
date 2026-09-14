# Database migrations

All schema changes must be added as ordered `NNN_description.js` files exporting
an `up(connection)` function. The application runs pending migrations at startup,
records each successful migration in `schema_migrations`, and serializes startup
migrations with a MySQL advisory lock. Keep migrations safe to retry because MySQL
DDL may commit implicitly if a migration is interrupted.
