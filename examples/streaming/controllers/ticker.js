class Ticker {
  // Server-streaming implementations take just `call` -- no callback. Write
  // as many messages as you like with `call.write()`, then `call.end()`.
  // This exact function is used both for real gRPC clients (bound via
  // `addService`) and for GraphQL subscribers (invoked by the auto-generated
  // subscribe resolver) -- it doesn't need to know or care which.
  Watch(call) {
    const { symbol, count } = call.request;
    const total = count > 0 ? count : 5;
    let sent = 0;

    const interval = setInterval(() => {
      sent += 1;
      call.write({
        symbol,
        price: Math.round(Math.random() * 10000) / 100,
      });

      if (sent >= total) {
        clearInterval(interval);
        call.end();
      }
    }, 1000);
  }
}

module.exports = Ticker;
