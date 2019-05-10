"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _lodash = require("lodash");

var _type = require("graphql/type");

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function add(type, properties, {
  filename
}) {
  const Type = capitalize(type);
  const name = `${filename}Add${Type}Mutation`;
  return `
export function add${Type}({ parent, properties, connectionName, filters }, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Add${Type}Input!) {
			Add${Type}(input: $input) {
				edge {
					node {
						...on ${type} { ${properties} }
					}
				}
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, parent, connectionName: connectionName.split('_').pop(), ...properties } };

	if (!parent)
		parent = ViewerHandler.VIEWER_ID;

	commitMutation(env, {
		mutation,
		variables,
		updater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName, filters);
			const edge = store.getRootField('Add${Type}').getLinkedRecord('edge');
			ConnectionHandler.insertEdgeAfter(connection, edge);
		},
		optimisticUpdater: store => {
			const node = store.create(\`client:new${Type}:$\{clientMutationId}\`, '${Type}');
			for (let prop in properties)
				if (properties[prop].id && store.get(properties[prop].id))
					node.setLinkedRecord(store.get(properties[prop].id));
				else
					node.setValue(properties[prop], prop);

			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName, filters);
			const edge = store.create(\`client:new${Type}Edge:$\{clientMutationId}\`, '${Type}ConnectionEdge');
			edge.setLinkedRecord(node, 'node');
			ConnectionHandler.insertEdgeAfter(connection, edge);
		},
		...callbacks
	});
}`;
}

function update(type, properties, {
  filename
}) {
  const Type = capitalize(type);
  const name = `${filename}Update${Type}Mutation`;
  return `
export function update${Type}(properties, env, callbacks, pessimistic) {
	const mutation = graphql\`
		mutation ${name}($input: Update${Type}Input!) {
			Update${Type}(input: $input) {
				node {
					...on ${type} { ${properties} }
				}
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, ...mapValues(properties, cleanNodeInput) } };
	const optimisticResponse = pessimistic
		? null
		: { Update${Type}: { node: properties } };

	commitMutation(env, {
		mutation,
		variables,
		optimisticResponse,
		...callbacks
	});
}`;
}

function remove(type, {
  filename
}) {
  const Type = capitalize(type);
  const name = `${filename}Remove${Type}Mutation`;
  return `
export function remove${Type}({ id, parent, connectionName, filters }, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Remove${Type}Input!) {
			Remove${Type}(input: $input) {
				id
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, id, parent, connectionName: connectionName.split('_').pop() } };

	if (!parent)
		parent = ViewerHandler.VIEWER_ID;
	
	commitMutation(env, {
		mutation,
		variables,
		updater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName, filters);
			const id = store.getRootField('Remove${Type}').getValue('id');
			ConnectionHandler.deleteNode(connection, id);
		},
		optimisticUpdater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName, filters);
			ConnectionHandler.deleteNode(connection, id);
		},
		...callbacks
	});
}`;
}

function updateGraph(type, field, {
  filename
}) {
  const Type = capitalize(type);
  const Field = capitalize(field);
  const name = `${filename}Update${Type}${Field}Mutation`;
  return `
export function update${Type}${Field}({ id, diff }, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Update${Type}${Field}Input!) {
			Update${Type}${Field}(input: $input) {
				node {
					...on ${type} { ${field} }
				}
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, id, diff: JSON.stringify(diff) } };
	// const optimisticResponse = () => properties;

	commitMutation(env, {
		mutation,
		variables,
		// optimisticResponse,
		...callbacks
	});
}`;
}

function getFields(type) {
  return typeof type._typeConfig.fields === 'function' ? type._typeConfig.fields() : type._typeConfig.fields;
}

function fields(type) {
  return (0, _lodash.map)(getFields(type), (field, name) => {
    if (/Connection$/.test(field.type._typeConfig && field.type._typeConfig.name)) return `${name}(first: 2147483647) { edges { node { id } } }`;
    const subType = field.type instanceof _type.GraphQLList ? field.type.ofType : field.type;

    if (subType instanceof _type.GraphQLObjectType || subType instanceof _type.GraphQLInterfaceType) {
      if (getFields(subType).hasOwnProperty('id')) return `${name} { id }`;else return `${name} { ${fields(subType)} }`;
    }

    return name;
  }).join(' ');
}

function _default(schema, options) {
  if (!options || !options.hasOwnProperty('filename')) throw new Error('Must include "filename" option because relay dumb af, but we like it anyway cuz it still has a nice body (of work)');
  let output = `
import { graphql, commitMutation } from 'react-relay';
import { ConnectionHandler, ViewerHandler } from 'relay-runtime';
import { mapValues } from 'lodash';
let counter = 0;
function cleanNodeInput(value) {
	if (value && value.hasOwnProperty('id'))
		return { id: value.id };
	if (Array.isArray(value))
		return value.map(cleanNodeInput);
	return value;
}`;

  for (let objectType of (0, _lodash.values)(schema.objectTypes)) {
    const properties = fields(objectType);
    output += add(objectType.name, properties, options);
    output += update(objectType.name, properties, options);
    output += remove(objectType.name, options);
    output += (0, _lodash.map)(getFields(objectType), ({
      diff
    }, name) => diff ? updateGraph(objectType.name, name, options) : '').join('');
  }

  return output;
}