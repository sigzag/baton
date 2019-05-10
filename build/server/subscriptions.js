"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _ws = require("ws");

var _graphql = require("graphql");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _asyncIterator(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _default({
  formatError = String,
  server,
  port,
  schema,
  rootValue,
  getContext = () => ({})
}) {
  const wss = new _ws.Server({
    server,
    port
  });
  wss.on('error', err => console.log('ws error on ' + new Date() + ':\n' + err.stack + '\n'));
  wss.on('connection', async (socket, upgradeReq) => {
    let context;

    try {
      context = _objectSpread({
        socket
      }, (await getContext(socket, upgradeReq)));
    } catch (error) {
      socket.send(JSON.stringify({
        errors: [error].map(formatError)
      }));
      return socket.close();
    }

    const subscriptions = {};

    async function subscribe({
      id,
      queryString,
      variables
    }) {
      if (id in subscriptions) return;
      const document = (0, _graphql.parse)(queryString);
      const errors = (0, _graphql.validate)(schema, document);
      if (errors.length) return socket.send(JSON.stringify({
        id,
        errors: errors.map(formatError)
      }));
      const iterator = await (0, _graphql.subscribe)(schema, document, null, context, variables);

      subscriptions[id] = () => iterator.return();

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(iterator), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const payload = _value;
          if (payload.errors) for (const error of payload.errors) console.log(error);
          socket.send(JSON.stringify(_objectSpread({
            id
          }, payload)));
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }

    function unsubscribe({
      id
    }) {
      if (id in subscriptions) {
        subscriptions[id]();
        subscriptions[id] = null;
      }
    }

    socket.on('message', message => {
      const _JSON$parse = JSON.parse(message),
            type = _JSON$parse.type,
            data = _JSON$parse.data;

      switch (type) {
        case 'subscribe':
          return subscribe(data);

        case 'unsubscribe':
          return unsubscribe(data);
      }
    });
    socket.on('close', () => Object.values(subscriptions).forEach(subscription => subscription && subscription()));
  });
}