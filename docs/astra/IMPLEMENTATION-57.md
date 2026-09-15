# Pass 57: Reload recovery and real cycle handoff

## Delivered

Pending goal saves now retain their command and accepted/unknown phase in sessionStorage, scoped to the authenticated actor, client and cycle. A reload offers explicit recovery without sending a request automatically. Recovered requests display the submitted target and note. Successfully completed checks remove the record; records older than 24 hours and invalid/non-goal commands are not restored. Storage failures explain that the page must stay open.

Goals now mounts its editor with an authenticated scope key. Sign-out/session-loss cleanup includes goal recovery, and late save callbacks cannot recreate records after session loss or editor unmount. This is tab-local reload recovery, not cross-device or guaranteed closed-tab recovery. Unsubmitted edits remain outside this record.

A real browser test exposed the cycle handoff navigating before the shared router blocker registered its settled state. Waiting for aggregate navigation state alone still raced the parent's passive effect. Handoff now waits for the aggregate state and defers navigation until the passive effects have finished, with cancellation on dependency changes/unmount.

## Verification

Seventeen web tests cover existing Goals/navigation behavior, explicit replay after remount, storage scope/expiry/path rejection, clearing on session end and late-response non-repopulation. All seventeen tests passed on the final change. Scoped lint, whitespace checks, API compilation and the web production build passed.

An isolated synthetic client signed in through the real browser and completed reload recovery after both an accepted write with a failed read and a committed write whose response was lost. Reloading sent no automatic write. The same client started a real application cycle using the API, saved its goal through the browser, and deliberately lost the confirmation response after server completion. After reload, explicit recovery returned to application rounds. Database checks confirmed one goal write, two confirmation requests, one confirmation audit and an unchanged step completion timestamp. All fixture cleanup was client-scoped.

The browser scenario initially failed at navigation and exposed the real blocker timing issue described above; it passed after the final fix. Recovery banner visual/accessibility qualification beyond the existing controls is still incomplete.

## Next backend finding

The cycle snapshot remained at version 4 while the goal was saved to version 5 before confirmation. The current cycle-creation endpoint captures the snapshot, and confirm-goal neither refreshes that snapshot nor receives an expected goal revision. The next batch must reconcile this contract with the governed cycle workflow, preserving confirmed historical snapshots and making stale confirmation explicit. Concurrent confirmation also remains unqualified.

A1/A2/A5 and the broader production roadmap remain in progress. No API source, migrations, runtime restarts, push, deployment or other worktree changes occurred.
