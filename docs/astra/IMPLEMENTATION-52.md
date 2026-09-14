# Pass 52: Evidence availability and distinct consultant access

## Delivered

Document refresh hints now invalidate client Plan and consultant execution queries, so submitted attachment availability updates in open evidence views. Consultant review names unavailable files and disables verification while allowing a correction request. Superseded but still available original files remain verifiable, consistent with server rules. Existing evidence identity, source pause and uncertain-decision checks remain in force.

## Verification

Thirty-four web tests passed across live refresh and response-review suites. Added coverage distinguishes deleted evidence from still-downloadable superseded evidence, retains the correction path, and verifies document hints include both evidence query families. Scoped lint, whitespace checks and web production build passed; API compilation was checked at the batch boundary.

A real browser scenario deleted a synthetic uploaded document through the API while the consultant had its response and unsent correction message open. Without manual reload, the warning appeared and verification became disabled. The message remained intact. A direct verification API request returned 409. The consultant requested correction, the client uploaded and selected new evidence, resubmitted, and the consultant verified it. Database checks retained the original attachment on the first submission and the new attachment on the corrected submission, with COMPLETE, CORRECTION_REQUESTED, COMPLETE, VERIFIED in order. This verifies an open-review transition, not a simultaneous deletion/verification transaction race.

A separate scenario used two distinct consultant accounts in isolated browser contexts. The temporary second consultant completed the normal password and authenticator enrollment/verification flow; its secret remained in process memory and was not committed or printed. Both had explicit assignments to the isolated test client. The first published one draft, the second's stale preview received 409, and refresh showed the new publication impact while retaining the losing draft. Deactivating the second assignment then caused its next protected Plan read to return 403. This is sequential competing-preview and authorization evidence, not a claim about all simultaneous or distributed races.

Synthetic clients, assignments, credentials/users, Plans and related fixture records were cleaned up; uploaded files were removed only after checking their absolute paths belonged to the isolated fixture under Astra storage. No preexisting account enrollment or Plan was changed. No API contracts, migrations or runtime restarts changed.

## Remaining

True in-flight deletion/verification races, missed-event/reconnect reconciliation under load, durable replay of lost approval responses and separate-Plan publication policy remain open. A1/A2/A5 and the broader production roadmap remain in progress. Next workflow review should cover source comparison, reconciliation and republishing after a source change. Other project versions remain untouched; no push or deployment occurred.
