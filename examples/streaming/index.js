const express = require('express');
const app = express();
const { expressMiddleware } = require('@apollo/server/express4');
const { RPCServer } = require('../..');
const Ticker = require('./controllers/ticker.js');

const methods = {
  ticker: new Ticker(),
};

const rpcServer = new RPCServer({
  graphql: true,
  grpc: {
    protoFile: `${__dirname}/../protos/streaming.proto`,
    packages: [
      {
        name: 'ticker',
        services: [
          {
            name: 'TickerSvc',
            implementation: methods.ticker,
          },
        ],
      },
    ],
  },
});

rpcServer.once('grpc_server_started', async (payload) => {
  console.log('gRPC server started on %s:%d', payload.ip, payload.port);

  if (rpcServer.gqlServer) {
    await rpcServer.gqlServer.start();
    app.use(
      '/graphql',
      express.json(),
      expressMiddleware(rpcServer.gqlServer, { context: rpcServer.gqlContext }),
    );
  }

  const server = app.listen(3000, () => {
    console.log('Server started. http://localhost:3000');
    console.log('  GraphQL (queries/mutations) http://localhost:3000/graphql');
    console.log('  GraphQL (subscriptions)     ws://localhost:3000/graphql');

    // Queries/mutations are served over the HTTP endpoint above.
    // Subscriptions (server-streaming RPCs) need a persistent connection,
    // so they're attached separately to the same http.Server, over
    // WebSocket, using the graphql-ws protocol.
    rpcServer.useSubscriptions(server);
  });
});
