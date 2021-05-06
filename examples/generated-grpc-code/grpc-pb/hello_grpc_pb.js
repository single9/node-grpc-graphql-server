// GENERATED CODE -- DO NOT EDIT!

'use strict';
var hello_pb = require('./hello_pb.js');

function serialize_helloworld_Empty(arg) {
  if (!(arg instanceof hello_pb.Empty)) {
    throw new Error('Expected argument of type helloworld.Empty');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_Empty(buffer_arg) {
  return hello_pb.Empty.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloReply(arg) {
  if (!(arg instanceof hello_pb.HelloReply)) {
    throw new Error('Expected argument of type helloworld.HelloReply');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloReply(buffer_arg) {
  return hello_pb.HelloReply.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloReplyWithGender(arg) {
  if (!(arg instanceof hello_pb.HelloReplyWithGender)) {
    throw new Error('Expected argument of type helloworld.HelloReplyWithGender');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloReplyWithGender(buffer_arg) {
  return hello_pb.HelloReplyWithGender.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloRequest(arg) {
  if (!(arg instanceof hello_pb.HelloRequest)) {
    throw new Error('Expected argument of type helloworld.HelloRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloRequest(buffer_arg) {
  return hello_pb.HelloRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloRequestWithGender(arg) {
  if (!(arg instanceof hello_pb.HelloRequestWithGender)) {
    throw new Error('Expected argument of type helloworld.HelloRequestWithGender');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloRequestWithGender(buffer_arg) {
  return hello_pb.HelloRequestWithGender.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloRequestWithRequired(arg) {
  if (!(arg instanceof hello_pb.HelloRequestWithRequired)) {
    throw new Error('Expected argument of type helloworld.HelloRequestWithRequired');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloRequestWithRequired(buffer_arg) {
  return hello_pb.HelloRequestWithRequired.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloReturnArrayReply(arg) {
  if (!(arg instanceof hello_pb.HelloReturnArrayReply)) {
    throw new Error('Expected argument of type helloworld.HelloReturnArrayReply');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloReturnArrayReply(buffer_arg) {
  return hello_pb.HelloReturnArrayReply.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_HelloReturnArrayRequest(arg) {
  if (!(arg instanceof hello_pb.HelloReturnArrayRequest)) {
    throw new Error('Expected argument of type helloworld.HelloReturnArrayRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_HelloReturnArrayRequest(buffer_arg) {
  return hello_pb.HelloReturnArrayRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_IntArrayReply(arg) {
  if (!(arg instanceof hello_pb.IntArrayReply)) {
    throw new Error('Expected argument of type helloworld.IntArrayReply');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_IntArrayReply(buffer_arg) {
  return hello_pb.IntArrayReply.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_helloworld_NestedReplyA(arg) {
  if (!(arg instanceof hello_pb.NestedReplyA)) {
    throw new Error('Expected argument of type helloworld.NestedReplyA');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_helloworld_NestedReplyA(buffer_arg) {
  return hello_pb.NestedReplyA.deserializeBinary(new Uint8Array(buffer_arg));
}


// import "google/protobuf/empty.proto";
//
var GreeterService = exports['helloworld.Greeter'] = {
  sayHello: {
    path: '/helloworld.Greeter/SayHello',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.HelloRequest,
    responseType: hello_pb.HelloReply,
    requestSerialize: serialize_helloworld_HelloRequest,
    requestDeserialize: deserialize_helloworld_HelloRequest,
    responseSerialize: serialize_helloworld_HelloReply,
    responseDeserialize: deserialize_helloworld_HelloReply,
  },
  sayHelloWithGender: {
    path: '/helloworld.Greeter/SayHelloWithGender',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.HelloRequestWithGender,
    responseType: hello_pb.HelloReplyWithGender,
    requestSerialize: serialize_helloworld_HelloRequestWithGender,
    requestDeserialize: deserialize_helloworld_HelloRequestWithGender,
    responseSerialize: serialize_helloworld_HelloReplyWithGender,
    responseDeserialize: deserialize_helloworld_HelloReplyWithGender,
  },
  sayHelloAgain: {
    path: '/helloworld.Greeter/SayHelloAgain',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.HelloRequest,
    responseType: hello_pb.HelloReply,
    requestSerialize: serialize_helloworld_HelloRequest,
    requestDeserialize: deserialize_helloworld_HelloRequest,
    responseSerialize: serialize_helloworld_HelloReply,
    responseDeserialize: deserialize_helloworld_HelloReply,
  },
  sayHelloReturnArray: {
    path: '/helloworld.Greeter/SayHelloReturnArray',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.HelloReturnArrayRequest,
    responseType: hello_pb.HelloReturnArrayReply,
    requestSerialize: serialize_helloworld_HelloReturnArrayRequest,
    requestDeserialize: deserialize_helloworld_HelloReturnArrayRequest,
    responseSerialize: serialize_helloworld_HelloReturnArrayReply,
    responseDeserialize: deserialize_helloworld_HelloReturnArrayReply,
  },
  sayHelloWithName: {
    path: '/helloworld.Greeter/SayHelloWithName',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.HelloRequestWithRequired,
    responseType: hello_pb.HelloReply,
    requestSerialize: serialize_helloworld_HelloRequestWithRequired,
    requestDeserialize: deserialize_helloworld_HelloRequestWithRequired,
    responseSerialize: serialize_helloworld_HelloReply,
    responseDeserialize: deserialize_helloworld_HelloReply,
  },
  sayIntArray: {
    path: '/helloworld.Greeter/SayIntArray',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.Empty,
    responseType: hello_pb.IntArrayReply,
    requestSerialize: serialize_helloworld_Empty,
    requestDeserialize: deserialize_helloworld_Empty,
    responseSerialize: serialize_helloworld_IntArrayReply,
    responseDeserialize: deserialize_helloworld_IntArrayReply,
  },
  sayNested: {
    path: '/helloworld.Greeter/SayNested',
    requestStream: false,
    responseStream: false,
    requestType: hello_pb.Empty,
    responseType: hello_pb.NestedReplyA,
    requestSerialize: serialize_helloworld_Empty,
    requestDeserialize: deserialize_helloworld_Empty,
    responseSerialize: serialize_helloworld_NestedReplyA,
    responseDeserialize: deserialize_helloworld_NestedReplyA,
  },
};

