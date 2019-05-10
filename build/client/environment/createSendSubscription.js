"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _reactNative = _interopRequireDefault(require("react-native"));

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _reconnectingWebsocket = _interopRequireDefault(require("reconnecting-websocket"));

require("./userAgent");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const send = function () {
  const subscribers = {};
  return function send(query) {
    const url = query.url;
    const host = url.split('?')[0];
    if (host in subscribers) return subscribers[host](query);
    const socket = new _reconnectingWebsocket.default(url, [], {
      debug: false
    });
    const pending = new Map();
    const messages = new _rxjs.Subject();

    socket.onopen = () => pending.forEach(subscribe);

    socket.onmessage = ({
      data
    }) => messages.next(JSON.parse(data)); // socket.onerror = (error) => console.log(error.status, error.message);


    socket.onclose = event => {// actual reconnecting happening here- thanks dumb half-recconecting-websocket
      // if (!event.wasClean)
      // 	socket._connect(), backoff.duration());
      // messages.error({ status: 0, code: error.code, message: 'Socket closed' });
      // delete subscribers[host];
    };

    const subscribe = ({
      id,
      variables,
      operation
    }) => socket.readyState === 1 && socket.send(JSON.stringify({
      type: 'subscribe',
      data: {
        id,
        variables,
        queryString: operation.text
      }
    }));

    const unsubscribe = ({
      id
    }) => socket.readyState === 1 && socket.send(JSON.stringify({
      type: 'unsubscribe',
      data: {
        id
      }
    }));

    subscribers[host] = query => _rxjs.Observable.create(sink => {
      pending.set(query.id, query);
      subscribe(query);
      const subscription = messages.pipe((0, _operators.filter)(({
        id
      }) => query.id === id)).subscribe(sink);
      return () => {
        pending.delete(query.id);
        subscription.unsubscribe();
        unsubscribe(query);

        if (!pending.size) {
          socket.close();
          delete subscribers[host];
        }
      };
    });

    return subscribers[host](query);
  };
}();

let counter = 0;

function _default(subscribe, store) {
  return function sendSubscription(operation, variables, cacheConfig = {}, observer) {
    return subscribe({
      id: operation.name + counter++,
      operation,
      variables,
      cacheConfig
    }, send, store);
  };
}