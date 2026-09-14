# Pass 51: Attachment replacement and competing previews

## Delivered

Correction responses now name each previous attachment that was not carried forward, distinguishing superseded files from unavailable evidence. The message directs clients to choose available replacements and explains that earlier submissions retain their original attachment records. Existing available files are still prefilled; no document is deleted by changing the response selection.

## Verification

Twenty-seven distinct focused web tests passed across attachment, response and builder suites. The new replacement case verifies excluded filenames/reasons, selection of a current replacement, a submission containing only its ID, unchanged original history and no DELETE operation. The first run needed a wait for the document-picker exit transition; the corrected attachment suite passed. Scoped lint, whitespace checks, API compilation and web production build passed.

A real browser roundtrip used an isolated synthetic client and the existing MFA-verified consultant. The client uploaded a PDF through the API, selected it in the browser and submitted the response. After consultant correction, the document replacement API stored a second PDF and superseded the first. The client saw the named exclusion, selected the replacement and resubmitted, and the consultant verified it. Database checks confirmed that the first submission retained the original document ID and the corrected submission referenced only the new one, with the four outcome events intact. No responses were mocked. The 390x844 screenshot was reviewed after the picker closed; an initial transition screenshot was replaced by a clean repeat. Fixture records and both stored files were removed with client-scoped database cleanup and checked absolute storage paths.

A separate two-tab browser scenario opened two different draft approval previews against the same client publication. The first approved successfully; the second received 409, its approval button stayed disabled, and explicit refresh reopened review with the new replacement impact. The first Plan remained ACTIVE and the competing Plan remained DRAFT. Both tabs used one verified consultant account. This complements the simultaneous service/database race coverage from pass 50, but does not establish distinct-consultant authorization or simultaneous browser request qualification.

## Remaining

Distinct-consultant browser authorization/contention, deleted or changed evidence during an in-flight review, durable replay of lost approval responses and separate-Plan policy remain open. No API contract, migration or runtime restart changed. A1/A2/A5 and the broader roadmap remain in progress. Other versions were untouched; no push or deployment occurred.
