# Pass 36: Cross-tab sign-out and accepted draft recovery

## Delivered together

Successful explicit sign-out now notifies other Astra tabs on the same origin. They invoke the existing session-loss cleanup, close private editors, release navigation blockers and preserve their own return paths. Local sign-out also signals mounted work immediately, preventing late callbacks before unmount. A failed sign-out does not send a notification or clear the authenticated state.

The transport uses an Astra-named BroadcastChannel plus storage events for fallback. Broadcast content is only session-ended; storage contains only a random nonce that is immediately removed. No identity, token, draft text or attachments are transmitted. Receivers do not republish, avoiding loops. Listeners and channels close on provider cleanup. If both transports are unavailable, local logout still completes; remote tabs must detect expiry through normal authenticated requests.

## Verification

17 distinct tests passed across session transport (3), authentication recovery (8) and pending-session work (6), over the batch. They cover message filtering, fallback, cleanup, denied storage, confirmed versus failed logout and existing private-work recovery. Scoped lint and whitespace checks passed. The grouped web build passed once; the existing bundle-size warning remains. No API changes or restart were required.

Two real Chromium browser runs used separate contexts, each with two tabs sharing only the synthetic review account's session. One used BroadcastChannel plus storage; the second disabled BroadcastChannel to exercise storage fallback. In the Plan tab, an intercepted PUT was sent to the real API and its successful response held before delivery to the editor. The tab opened the leave-page dialog while that save remained pending. Signing out through the other tab's actual account menu redirected both tabs, removed the Plan dialog and private editor, and preserved the Plan tab's exact query/fragment return path.

After releasing the delayed response and signing in again, the server-accepted draft was recovered. Its original synthetic note was restored through the ordinary Save draft action. This increments the synthetic draft revision without changing its final content; no outcomes or publications were created. Both browser runs recorded no page errors. Raw scripts/results remain ignored under .tmp/astra-runtime/cross-tab-*; the user's open browser tabs and completed Plan were untouched.

## Remaining

This establishes explicit same-origin sign-out propagation and accepted draft-save recovery. It does not qualify switching accounts without sign-out, browser processes that miss both transports, server-side revocation without a client request, or accepted uploads whose acknowledgement is lost. Those transitions, assistive-technology/mobile keyboard qualification, consultant MFA-dependent visuals, separate-Plan replacement and broader A1/A2/A5 production gates remain open.
