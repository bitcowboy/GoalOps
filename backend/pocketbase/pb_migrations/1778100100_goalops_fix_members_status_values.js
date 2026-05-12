/// <reference path="../pb_data/types.d.ts" />

/**
 * Ensure members.status uses the current active/inactive select values.
 * Some local databases had an empty or legacy select value set.
 */
migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members')
    const field = members.fields.getByName('status')
    if (!field) return

    field.values = ['active', 'inactive']
    app.save(members)

    try {
      const rows = app.findRecordsByFilter('members', 'status = ""', '', 500, 0)
      for (const row of rows) {
        row.set('status', 'active')
        app.save(row)
      }
    } catch (_) {
      /** best effort backfill */
    }
  },
  () => {
    /** Keep current values on rollback. */
  },
)
