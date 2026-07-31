export default class StreamEcho {
  ServerStream(call: {
    request: { q: string };
    write: (chunk: any) => void;
    end: () => void;
  }) {
    call.write({ a: `${call.request.q}-1` });
    call.write({ a: `${call.request.q}-2` });
    call.write({ a: `${call.request.q}-3` });
    call.end();
  }
}
