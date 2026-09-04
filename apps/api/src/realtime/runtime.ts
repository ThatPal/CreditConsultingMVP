import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import type { LiveEventEnvelope } from '@credit/shared';
import { createClient } from 'redis';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { Logger } from 'pino';
import type { AuthPrincipal } from '../auth/types.js';
import { publishLiveUpdate } from '../liveUpdates.js';

export const REALTIME_CHANNEL = 'credit:realtime:events';
export const PRESENCE_TTL_SECONDS = 90;
const subscriptionSchema = z.object({ scope: z.literal('client'), clientId: z.string().uuid() });

export const clientRoom = (clientId: string) => `client:${clientId}`;
export const userRoom = (userId: string) => `user:${userId}`;

export async function startRealtimeRuntime(options: {
  server: HttpServer;
  redisUrl: string;
  webOrigin: string;
  logger: Logger;
  resolvePrincipal(headers: import('node:http').IncomingHttpHeaders): Promise<AuthPrincipal | null>;
  canSubscribe(principal: AuthPrincipal, clientId: string): Promise<boolean>;
}) {
  const pub = createClient({ url: options.redisUrl });
  const sub = pub.duplicate();
  const events = pub.duplicate();
  await Promise.all([pub.connect(), sub.connect(), events.connect()]);
  const io = new Server(options.server, {
    cors: { origin: options.webOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.adapter(createAdapter(pub, sub));

  io.use(async (socket, next) => {
    try {
      const principal = await options.resolvePrincipal(socket.handshake.headers);
      if (!principal) return next(new Error('AUTH_REQUIRED'));
      socket.data.principal = principal;
      next();
    } catch {
      next(new Error('AUTH_REQUIRED'));
    }
  });

  io.on('connection', async (socket) => {
    const principal = socket.data.principal as AuthPrincipal;
    const presenceKey = `credit:presence:${principal.userId}:${socket.id}`;
    const refreshPresence = setInterval(
      () => void pub.expire(presenceKey, PRESENCE_TTL_SECONDS),
      (PRESENCE_TTL_SECONDS * 1000) / 2,
    );
    socket.on('subscribe', async (input, acknowledge?: (result: unknown) => void) => {
      try {
        const parsed = subscriptionSchema.safeParse(input);
        if (!parsed.success) return acknowledge?.({ ok: false, code: 'INVALID_SUBSCRIPTION' });
        const current = await options.resolvePrincipal(socket.handshake.headers);
        const allowed = current && (await options.canSubscribe(current, parsed.data.clientId));
        if (!allowed) return acknowledge?.({ ok: false, code: 'FORBIDDEN' });
        socket.data.principal = current;
        await socket.join(clientRoom(parsed.data.clientId));
        acknowledge?.({ ok: true, refetch: true });
      } catch (error) {
        options.logger.error({ err: error, socketId: socket.id }, 'Realtime subscription failed');
        acknowledge?.({ ok: false, code: 'SUBSCRIPTION_FAILED' });
      }
    });
    socket.on('disconnect', () => {
      clearInterval(refreshPresence);
      void pub.del(presenceKey);
    });
    await socket.join(userRoom(principal.userId));
    await pub.setEx(presenceKey, PRESENCE_TTL_SECONDS, 'connected');
  });

  await events.subscribe(REALTIME_CHANNEL, async (raw) => {
    let event: LiveEventEnvelope;
    try {
      event = JSON.parse(raw) as LiveEventEnvelope;
    } catch {
      options.logger.warn('Rejected malformed realtime envelope');
      return;
    }
    publishLiveUpdate(event.clientId, ...event.domains);
    // Every runtime instance receives the canonical event subscription and must
    // authorize only its own connected sockets. A distributed fetch introduces
    // an unnecessary adapter round-trip and can race consecutive revocation
    // events while also asking this process to authorize remote socket proxies.
    const socketIds = io.sockets.adapter.rooms.get(clientRoom(event.clientId)) ?? new Set<string>();
    const sockets = [...socketIds].flatMap((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      return socket ? [socket] : [];
    });
    await Promise.all(
      sockets.map(async (socket) => {
        const principal = await options.resolvePrincipal(socket.handshake.headers);
        if (!principal || !(await options.canSubscribe(principal, event.clientId))) {
          await socket.leave(clientRoom(event.clientId));
          socket.emit('access.revoked', { clientId: event.clientId, refetch: true });
          return;
        }
        socket.emit('resource.changed', event);
      }),
    );
  });

  return {
    io,
    async close() {
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.allSettled([events.quit(), sub.quit(), pub.quit()]);
    },
  };
}
