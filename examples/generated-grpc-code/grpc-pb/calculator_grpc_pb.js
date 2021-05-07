// GENERATED CODE -- DO NOT EDIT!

'use strict';
var calculator_pb = require('./calculator_pb.js');

function serialize_calculator_CalculatorResponse(arg) {
  if (!(arg instanceof calculator_pb.CalculatorResponse)) {
    throw new Error('Expected argument of type calculator.CalculatorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_calculator_CalculatorResponse(buffer_arg) {
  return calculator_pb.CalculatorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_calculator_OneDoubleRequest(arg) {
  if (!(arg instanceof calculator_pb.OneDoubleRequest)) {
    throw new Error('Expected argument of type calculator.OneDoubleRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_calculator_OneDoubleRequest(buffer_arg) {
  return calculator_pb.OneDoubleRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_calculator_TwoDoubleRequest(arg) {
  if (!(arg instanceof calculator_pb.TwoDoubleRequest)) {
    throw new Error('Expected argument of type calculator.TwoDoubleRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_calculator_TwoDoubleRequest(buffer_arg) {
  return calculator_pb.TwoDoubleRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


var SimpleService = exports['calculator.Simple'] = {
  add: {
    path: '/calculator.Simple/add',
    requestStream: false,
    responseStream: false,
    requestType: calculator_pb.TwoDoubleRequest,
    responseType: calculator_pb.CalculatorResponse,
    requestSerialize: serialize_calculator_TwoDoubleRequest,
    requestDeserialize: deserialize_calculator_TwoDoubleRequest,
    responseSerialize: serialize_calculator_CalculatorResponse,
    responseDeserialize: deserialize_calculator_CalculatorResponse,
  },
  minus: {
    path: '/calculator.Simple/minus',
    requestStream: false,
    responseStream: false,
    requestType: calculator_pb.TwoDoubleRequest,
    responseType: calculator_pb.CalculatorResponse,
    requestSerialize: serialize_calculator_TwoDoubleRequest,
    requestDeserialize: deserialize_calculator_TwoDoubleRequest,
    responseSerialize: serialize_calculator_CalculatorResponse,
    responseDeserialize: deserialize_calculator_CalculatorResponse,
  },
  multiply: {
    path: '/calculator.Simple/multiply',
    requestStream: false,
    responseStream: false,
    requestType: calculator_pb.TwoDoubleRequest,
    responseType: calculator_pb.CalculatorResponse,
    requestSerialize: serialize_calculator_TwoDoubleRequest,
    requestDeserialize: deserialize_calculator_TwoDoubleRequest,
    responseSerialize: serialize_calculator_CalculatorResponse,
    responseDeserialize: deserialize_calculator_CalculatorResponse,
  },
  devide: {
    path: '/calculator.Simple/devide',
    requestStream: false,
    responseStream: false,
    requestType: calculator_pb.TwoDoubleRequest,
    responseType: calculator_pb.CalculatorResponse,
    requestSerialize: serialize_calculator_TwoDoubleRequest,
    requestDeserialize: deserialize_calculator_TwoDoubleRequest,
    responseSerialize: serialize_calculator_CalculatorResponse,
    responseDeserialize: deserialize_calculator_CalculatorResponse,
  },
};

var ComplexService = exports['calculator.Complex'] = {
  sqrt: {
    path: '/calculator.Complex/sqrt',
    requestStream: false,
    responseStream: false,
    requestType: calculator_pb.OneDoubleRequest,
    responseType: calculator_pb.CalculatorResponse,
    requestSerialize: serialize_calculator_OneDoubleRequest,
    requestDeserialize: deserialize_calculator_OneDoubleRequest,
    responseSerialize: serialize_calculator_CalculatorResponse,
    responseDeserialize: deserialize_calculator_CalculatorResponse,
  },
};

