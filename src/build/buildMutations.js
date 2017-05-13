import {
	values,
	toPairs,
	map
} from 'lodash';
import {
	GraphQLList,
	GraphQLObjectType,
	GraphQLInterfaceType
} from 'graphql/type';

function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function add(type, properties, { filename }) {
	const Type = capitalize(type);
	const name = `${filename}Add${Type}Mutation`;
	return `
export function add${Type}({ parent, properties, connectionName }, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Add${Type}Input!) {
			Add${Type}(input: $input) {
				edge {
					node {
						...on ${type} {
							${properties.join(' ')}
						}
					}
				}
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, parent, connectionName: connectionName.split('_').pop(), ...properties } };

	commitMutation(env, {
		mutation,
		variables,
		updater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName);
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
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName);
			const edge = store.create(\`client:new${Type}Edge:$\{clientMutationId}\`, '${Type}ConnectionEdge');
			edge.setLinkedRecord(node, 'node');
			ConnectionHandler.insertEdgeAfter(connection, edge);
		},
		...callbacks
	});
}`;
}
function update(type, properties, { filename }) {
	const Type = capitalize(type);
	const name = `${filename}Update${Type}Mutation`;
	return `
export function update${Type}(properties, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Update${Type}Input!) {
			Update${Type}(input: $input) {
				node {
					...on ${type} {
						${properties.join(' ')}
					}
				}
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, ...properties } };
	const optimisticResponse = () => properties;

	commitMutation(env, {
		mutation,
		variables,
		optimisticResponse,
		...callbacks
	});
}`;
}
function remove(type, { filename }) {
	const Type = capitalize(type);
	const name = `${filename}Remove${Type}Mutation`;
	return `
export function remove${Type}({ id, parent, connectionName }, env, callbacks) {
	const mutation = graphql\`
		mutation ${name}($input: Remove${Type}Input!) {
			Remove${Type}(input: $input) {
				id
			}
		}
	\`;
	const clientMutationId = \`${name}$\{counter++}\`;
	const variables = { input: { clientMutationId, id, parent, connectionName: connectionName.split('_').pop() } };

	commitMutation(env, {
		mutation,
		variables,
		updater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName);
			const id = store.getRootField('Remove${Type}').getValue('id');
			ConnectionHandler.deleteNode(connection, id);
		},
		optimisticUpdater: store => {
			const parentProxy = store.get(parent);
			const connection = ConnectionHandler.getConnection(parentProxy, connectionName);
			ConnectionHandler.insertEdgeAfter(connection, id);
		},
		...callbacks
	});
}`;
}

export default function(schema, options) {
	if (!options || !options.hasOwnProperty('filename'))
		throw new Error('Must include "filename" option');

	let output = `
import { graphql, commitMutation } from 'react-relay';
let counter = 0;`;
	for (let objectType of values(schema.objectTypes)) {
		const properties = map(
			objectType._typeConfig.fields,
			(field, name) => {
				if (/Connection$/.test(field.type._typeConfig && field.type._typeConfig.name))
					return `${name}(first: 2147483647) { edges { node { id } } }`;
				if (
					field.type instanceof GraphQLObjectType ||
					field.type instanceof GraphQLInterfaceType ||
					field.type instanceof GraphQLList && (
						field.type.ofType instanceof GraphQLObjectType ||
						field.type.ofType instanceof GraphQLInterfaceType
					))
					return `${name} { id }`;
				return name;
			}
		);
		output += add(objectType.name, properties, options);
		output += update(objectType.name, properties, options);
		output += remove(objectType.name, options);
	}
	return output;
}