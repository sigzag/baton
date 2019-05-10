"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _relayRuntime = require("relay-runtime");

const ObjectHandler = {
  update(proxy, payload) {
    const record = proxy.get(payload.dataID);
    if (!record) return;

    record._mutator.setValue(payload.dataID, record.getValue(payload.fieldKey), payload.handleKey);
  }

};

function _default(options) {
  return function handlerProvider(handle) {
    switch (handle) {
      case 'connection':
        return _relayRuntime.ConnectionHandler;

      case 'viewer':
        return _relayRuntime.ViewerHandler;

      case 'object':
        return ObjectHandler;
    }

    throw new Error(`handlerProvider: No handler provided for ${handle}`);
  };
}