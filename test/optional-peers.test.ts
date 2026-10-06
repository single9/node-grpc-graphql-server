// GraphQL dependencies are optional peers: a gRPC-only user without them
// installed must still be able to load the package.
const OPTIONAL_PEERS = [
  'graphql',
  '@apollo/server',
  '@graphql-tools/schema',
  'graphql-subscriptions',
  'graphql-ws/use/ws',
  'ws',
];

describe('optional peer dependencies', () => {
  it('loads the package without any GraphQL peer installed', () => {
    jest.isolateModules(() => {
      OPTIONAL_PEERS.forEach((name) => {
        jest.doMock(name, () => {
          throw new Error(`Cannot find module '${name}'`);
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../src');
      expect(pkg.RPCServer).toBeDefined();
      expect(pkg.initRPCClient).toBeDefined();
    });
  });
});
