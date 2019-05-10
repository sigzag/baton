"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createEnvironment;

var _relayRuntime = require("relay-runtime");

var _createHandlerProvider = _interopRequireDefault(require("./createHandlerProvider"));

var _createFetchQuery = _interopRequireDefault(require("./createFetchQuery"));

var _createSendSubscription = _interopRequireDefault(require("./createSendSubscription"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function createEnvironment(_ref) {
  let query = _ref.query,
      mutate = _ref.mutate,
      subscribe = _ref.subscribe,
      options = _objectWithoutProperties(_ref, ["query", "mutate", "subscribe"]);

  const store = new _relayRuntime.Store(new _relayRuntime.RecordSource());

  const network = _relayRuntime.Network.create((0, _createFetchQuery.default)(query, mutate), subscribe && (0, _createSendSubscription.default)(subscribe));

  const environment = new _relayRuntime.Environment({
    store,
    network,
    handlerProvider: (0, _createHandlerProvider.default)(options)
  });
  return environment;
}