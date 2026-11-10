# packages/feature-bookings

The bookings screens: list, filters, status changes, creation form. Depends only
on `@booking/core`, `@booking/api` and `@booking/ui`. Data through generated
hooks; the app's route passes URL state (the status) as props. Tests next to
the components, with MSW handlers from `@booking/api/mocks`.
