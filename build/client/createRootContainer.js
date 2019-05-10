"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createFragmentRootContainer = createFragmentRootContainer;
exports.createRefetchRootContainer = createRefetchRootContainer;
exports.createPaginationRootContainer = createPaginationRootContainer;
exports.withEnvironment = exports.EnvironmentConsumer = exports.EnvironmentProvider = void 0;

var _react = _interopRequireWildcard(require("react"));

var _reactRelay = require("react-relay");

var _QueryContainer = _interopRequireDefault(require("./QueryContainer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const _createContext = (0, _react.createContext)(),
      EnvironmentProvider = _createContext.Provider,
      EnvironmentConsumer = _createContext.Consumer;

exports.EnvironmentConsumer = EnvironmentConsumer;
exports.EnvironmentProvider = EnvironmentProvider;

const withEnvironment = Component => props => _react.default.createElement(EnvironmentConsumer, null, environment => _react.default.createElement(Component, _extends({}, props, {
  environment: environment
})));

exports.withEnvironment = withEnvironment;

const getDisplayName = Component => Component.displayName || Component.name || 'Component';

function createFragmentRootContainer(Component, fragments, query, {
  variables: defaultVariables,
  cacheConfig
} = {}) {
  const Container = (0, _reactRelay.createFragmentContainer)(Component, fragments);

  const RootContainer = (variables = {}) => _react.default.createElement(EnvironmentConsumer, null, environment => _react.default.createElement(_QueryContainer.default, _extends({
    Container: Container,
    environment: environment,
    query: query,
    variables: _objectSpread({}, defaultVariables, variables),
    cacheConfig: cacheConfig
  }, variables)));

  RootContainer.displayName = `RootFragmentContainer(${getDisplayName(Component)})`;
  return RootContainer;
}

function createRefetchRootContainer(Component, fragments, query, {
  variables: defaultVariables,
  cacheConfig
} = {}) {
  const Container = (0, _reactRelay.createRefetchContainer)(Component, fragments, query);

  const RootContainer = (variables = {}) => _react.default.createElement(EnvironmentConsumer, null, environment => _react.default.createElement(_QueryContainer.default, _extends({
    Container: Container,
    environment: environment,
    query: query,
    variables: _objectSpread({}, defaultVariables, variables),
    cacheConfig: cacheConfig
  }, variables)));

  RootContainer.displayName = `RootRefetchContainer(${getDisplayName(Component)})`;
  return RootContainer;
}

function createPaginationRootContainer(Component, fragments, query, _ref = {}) {
  let defaultVariables = _ref.variables,
      cacheConfig = _ref.cacheConfig,
      options = _objectWithoutProperties(_ref, ["variables", "cacheConfig"]);

  const Container = (0, _reactRelay.createPaginationContainer)(Component, fragments, _objectSpread({}, options, {
    query
  }));

  const RootContainer = (variables = {}) => _react.default.createElement(EnvironmentConsumer, null, environment => _react.default.createElement(_QueryContainer.default, _extends({
    Container: Container,
    environment: environment,
    query: query,
    variables: _objectSpread({}, defaultVariables, variables),
    cacheConfig: cacheConfig
  }, variables)));

  RootContainer.displayName = `RootPaginationContainer(${getDisplayName(Component)})`;
  return RootContainer;
}