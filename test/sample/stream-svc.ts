export default class StreamSvcImpl {
  Unary(
    call: { request: { q: string } },
    callback: (err: any, res: any) => void,
  ) {
    callback(null, { a: `echo:${call.request.q}` });
  }

  ServerStream(call: {
    request: { q: string };
    metadata: { get: (key: string) => string[] };
    write: (chunk: any) => void;
    end: () => void;
  }) {
    const tag = call.metadata.get('x-test')[0];
    const prefix = tag ? `${tag}:` : '';

    for (let i = 1; i <= 3; i += 1) {
      call.write({ a: `${prefix}${call.request.q}-${i}` });
    }
    call.end();
  }

  ClientStream(
    call: {
      on: (event: string, handler: (arg?: any) => void) => void;
    },
    callback: (err: any, res: any) => void,
  ) {
    const chunks: string[] = [];
    call.on('data', (req: { q: string }) => chunks.push(req.q));
    call.on('end', () => {
      if (chunks.includes('FAIL')) {
        callback(new Error('client-stream failed intentionally'), null);
        return;
      }
      callback(null, { a: chunks.join(',') });
    });
  }

  BidiStream(call: {
    on: (event: string, handler: (arg?: any) => void) => void;
    write: (chunk: any) => void;
    end: () => void;
  }) {
    call.on('data', (req: { q: string }) => call.write({ a: `echo:${req.q}` }));
    call.on('end', () => call.end());
  }
}
