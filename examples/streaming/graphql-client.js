const { createClient } = require('graphql-ws');
const WebSocket = require('ws');

const client = createClient({
  url: 'ws://localhost:3000/graphql',
  webSocketImpl: WebSocket,
});

// Note the flat field name: subscription fields can't be nested the way
// query/mutation fields are (`ticker { TickerSvc { Watch(...) } }`) --
// GraphQL only allows the special subscribe/resolve execution one level
// below the `Subscription` root, so this library names them
// `<package>_<Service>_<Method>` instead.
const query = `
  subscription Watch($symbol: String!, $count: Int!) {
    ticker_TickerSvc_Watch(request: { symbol: $symbol, count: $count }) {
      symbol
      price
    }
  }
`;

console.log('Subscribing to ticker_TickerSvc_Watch...');

client.subscribe(
  { query, variables: { symbol: 'ACME', count: 5 } },
  {
    next: (msg) => console.log('tick:', msg.data.ticker_TickerSvc_Watch),
    error: (err) => console.error('subscription error:', err),
    complete: () => {
      console.log('stream complete');
      client.dispose();
    },
  },
);
