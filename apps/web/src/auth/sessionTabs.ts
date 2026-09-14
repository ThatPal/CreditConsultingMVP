// Same-origin transport only; never include identity, credentials or response content.
const channelName = 'astra:session-ended:v1';
const message = 'session-ended';
export function connectSessionTabs(onEnd: () => void) {
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === message) onEnd();
    };
  } catch {
    /* Storage events remain available when BroadcastChannel is unavailable. */
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === channelName && event.newValue && /^[0-9a-f-]{36}$/i.test(event.newValue))
      onEnd();
  };
  window.addEventListener('storage', onStorage);
  return {
    publish() {
      try {
        channel?.postMessage(message);
      } catch {
        /* Try storage below. */
      }
      try {
        localStorage.setItem(channelName, crypto.randomUUID());
        localStorage.removeItem(channelName);
      } catch {
        /* Local sign-out still completes if both transports are unavailable. */
      }
    },
    close() {
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
      window.removeEventListener('storage', onStorage);
    },
  };
}

export function announceSessionChange() {
  const connection = connectSessionTabs(() => undefined);
  try {
    connection.publish();
  } finally {
    connection.close();
  }
}
