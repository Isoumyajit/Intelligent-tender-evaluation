"""In-memory fixture data that the /api/* routes serve today.

The shape of every fixture dict mirrors the corresponding pydantic model
in `app.api_models` exactly (in snake_case — conversion to camelCase
happens when pydantic serialises the response).

When the real persistence layer arrives, replace `FixtureStore` with an
SQLAlchemy-backed equivalent that exposes the same method surface.
Routes don't change.
"""
