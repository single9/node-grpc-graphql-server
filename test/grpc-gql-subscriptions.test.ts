import express from 'express';
import WebSocket from 'ws';
import { expressMiddleware } from '@apollo/server/express4';
import { createClient, Client } from 'graphql-ws';
import { Server } from 'http';
import { RPCServer } from '../src';
import StreamEcho from './sample/stream-echo';

const app = express();

function subscribeCollect(
  client: Client,
  query: string,
  variables?: Record<string, any>,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const values: any[] = [];
    client.subscribe(
      { query, variables },
      {
        next: (data) => values.push(data),
        error: reject,
        complete: () => resolve(values),
      },
    );
  });
}

describe('Test GraphQL Subscriptions over WebSocket (server-streaming RPCs)', () => {
  let rpcServer: RPCServer;
  let server: Server;
  let wsClient: Client;

  const methods = {
    streamEcho: new StreamEcho(),
  };

  it('should start gRPC server with GraphQL and subscriptions', (done) => {
    rpcServer = new RPCServer({
      graphql: true,
      port: 50054,
      grpc: {
        protoFile: `${__dirname}/sample/protos/streaming.proto`,
        packages: [
          {
            name: 'streaming',
            services: [
              {
                name: 'StreamSvc',
                implementation: methods.streamEcho,
              },
            ],
          },
        ],
      },
    });

    rpcServer.once('grpc_server_started', async () => {
      if (rpcServer.gqlServer) {
        await rpcServer.gqlServer.start();
        app.use(
          '/graphql',
          express.json(),
          expressMiddleware(rpcServer.gqlServer, {
            context: rpcServer.gqlContext,
          }),
        );
      }

      server = app.listen(3346, () => {
        rpcServer.useSubscriptions(server);
        done();
      });
    });
  });

  it('declares the Subscription field in the generated schema', () => {
    expect(rpcServer.rpcService.gqlSchema).toMatch(
      /extend type Subscription \{\s*streaming_StreamSvc_ServerStream/,
    );
  });

  it('streams chunks in order and completes over graphql-ws', async () => {
    wsClient = createClient({
      url: 'ws://localhost:3346/graphql',
      webSocketImpl: WebSocket,
    });

    const values = await subscribeCollect(
      wsClient,
      `subscription Watch($q: String!) {
        streaming_StreamSvc_ServerStream(request: { q: $q }) {
          a
        }
      }`,
      { q: 'x' },
    );

    expect(values).toEqual([
      { data: { streaming_StreamSvc_ServerStream: { a: 'x-1' } } },
      { data: { streaming_StreamSvc_ServerStream: { a: 'x-2' } } },
      { data: { streaming_StreamSvc_ServerStream: { a: 'x-3' } } },
    ]);
  });

  it('should try shutdown RPC Server', async () => {
    await rpcServer.tryShutdown();
  });

  afterAll(async () => {
    await wsClient?.dispose();
    await rpcServer.gqlServer?.stop();
    server.close();
  });
});
