/// <reference path="../pb_data/types.d.ts" />

/**
 * Product scope update: remove the legacy misc_work collection and all records
 * in existing local databases.
 */
migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('misc_work')
      app.delete(col)
    } catch (_) {
      /** collection already absent */
    }
  },
  () => {
    /** Intentionally not recreated on rollback; the feature is out of scope. */
  },
)
