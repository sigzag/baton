"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _lodash = require("lodash");

var _QueryRenderer = _interopRequireDefault(require("./QueryRenderer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var _default = (_ref) => {
  let Container = _ref.Container,
      query = _ref.query,
      variables = _ref.variables,
      cacheConfig = _ref.cacheConfig,
      environment = _ref.environment,
      passProps = _objectWithoutProperties(_ref, ["Container", "query", "variables", "cacheConfig", "environment"]);

  return _react.default.createElement(_QueryRenderer.default, {
    query: query,
    variables: (0, _lodash.pick)(variables, (query.modern ? query.modern() : query()).fragment.argumentDefinitions.map(({
      name
    }) => name)),
    cacheConfig: cacheConfig,
    environment: environment,
    dataFrom: "STORE_THEN_NETWORK",
    render: ({
      error,
      props = {}
    }) => _react.default.createElement(Container, _extends({
      key: "container",
      variables: variables,
      loading: !error && !props,
      error: error
    }, passProps, (query.modern ? query.modern() : query()).fragment.selections.map(selection => selection.kind === 'Condition' ? selection.selections[0] : selection).reduce((fragments, {
      alias,
      name
    }) => _objectSpread({}, fragments, {
      [alias || name]: props && props[alias || name] || null
    }), {})))
  });
};

exports.default = _default;