import express from 'express';
import { expressMiddleware } from '@apollo/server/express4';
import { request, gql } from 'graphql-request';
import { Server } from 'http';
import { RPCServer } from '../src';
import BytesEcho from './sample/bytes-echo';

const app = express();

describe('Test the Bytes custom scalar end-to-end', () => {
  let rpcServer: RPCServer;
  let server: Server;

  const methods = {
    bytesEcho: new BytesEcho(),
  };

  it('should start gRPC server with GraphQL', (done) => {
    rpcServer = new RPCServer({
      graphql: true,
      port: 50053,
      grpc: {
        protoFile: `${__dirname}/sample/protos/bytes-echo.proto`,
        packages: [
          {
            name: 'bytesecho',
            services: [
              {
                name: 'Echo',
                implementation: methods.bytesEcho,
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

      server = app.listen(3345, () => {
        done();
      });
    });
  });

  it('declares the Bytes scalar in the generated schema', () => {
    expect(rpcServer.rpcService.gqlSchema).toMatch(/scalar Bytes/);
  });

  it('round-trips binary data through the Bytes scalar as base64', async () => {
    const payload = Buffer.from('hello bytes', 'utf8');
    const base64 = payload.toString('base64');

    const query = gql`
      query EchoBytes($data: Bytes!) {
        bytesecho {
          Echo {
            EchoBytes(request: { data: $data }) {
              data
            }
          }
        }
      }
    `;

    const data = await request('http://localhost:3345/graphql', query, {
      data: base64,
    });

    expect(data).toHaveProperty('bytesecho.Echo.EchoBytes.data', base64);
    expect(
      Buffer.from(
        data['bytesecho']['Echo']['EchoBytes']['data'],
        'base64',
      ).toString('utf8'),
    ).toBe('hello bytes');
  });

  it('should try shutdown RPC Server', async () => {
    await rpcServer.tryShutdown();
  });

  afterAll(async () => {
    await rpcServer.gqlServer?.stop();
    server.close();
  });
});
