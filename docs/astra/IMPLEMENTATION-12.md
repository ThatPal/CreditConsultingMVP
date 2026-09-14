# Astra implementation pass 12: Selective wording resolution

Continues pass 11 on `codex/astra-production`.

## Delivered

- The conflict comparison offers explicit selections for Plan title and matching-step client title, instructions and private rationale. Each selection shows both values.
- Applying choices starts with the latest loaded saved Plan and changes only selected eligible wording. It retains saved source versions, graph/paths, response schema, ownership and recorded progress. Removed steps and steps with progress on either side are excluded.
- The resulting working copy uses the saved revision and baseline. It remains unsaved, cannot be approved while dirty, and requires explicit Save draft followed by separate approval. Unselected local edits are discarded with explanatory copy before the action.
- Incoming changes to the saved comparison data reset selections, requiring review again. Save still uses the existing server optimistic revision check if another write arrives afterward.

## Verification and limits

- Focused consultant/comparison/resolution tests cover selected-only changes, preservation of server context/schema, removed/progressed steps, no write on applying choices, and a subsequent explicit save using the newer revision. Production build, targeted lint and whitespace checks pass. Existing bundle-size warning remains.
- This is bounded wording resolution, not automatic three-way merging. Graph changes, response schemas, additions/deletions and source reconciliation still use their existing workflows and need further conflict tooling.
- Authenticated browser review remains pending the consultant MFA challenge recorded in pass 10. This checkpoint has automated component/integration evidence, not completed browser or accessibility qualification.
- Next: response-aware publication preview and remaining Plan lifecycle work, plus the full roadmap's integration and production gates. No production wave is declared complete.

All work is isolated to Astra. No backend migration, push, merge, deployment or external action occurred.
