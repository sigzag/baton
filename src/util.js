import { toPairs, isPlainObject } from 'lodash';

// Mongoose stuffs
export function pathPairs(paths, { skip } = {}) {
	const result = [];
	const schemas = {};
	if (paths.constructor.name === 'EmbeddedDocument' || paths.constructor.name === 'SchemaType')
		paths = paths.schema.paths;
	for (let [name, path] of toPairs(paths)) {
		if (skip && ~skip.indexOf(name))
			continue;
		if (~name.indexOf('.')) {
			const [head, ...tail] = name.split('.');
			if (!schemas[head])
				result.push([head, schemas[head] = {}]);
			schemas[head][tail.join('.')] = path;
		} else
			result.push([name, path]);
	}
	return result;
}
export function pathType(path) {
	if (isPlainObject(path))
		return 'object';
	else if (path.enumValues && path.enumValues.length)
		return 'enum';
	else
		switch (path.constructor.name) {
			case 'ObjectId':
				return 'id';
			case 'DocumentArray':
			case 'SchemaArray':
				if (path.caster.options && path.caster.options.list)
					return 'array';
				if (path.schema && path.options.connection === path.schema)
					return 'objects';
				if (path.caster.constructor.name === 'ObjectId')
					return 'ids';
				else
					return 'array';
			case 'EmbeddedDocument':
			case 'SchemaType':
				return 'object';
			case 'SchemaNumber':
				return 'number';
			case 'SchemaBoolean':
				return 'boolean';
			case 'SchemaDate':
				return 'date';
			default:
				return 'string';
		}
}
export function isUnion(model) {
	return model.schema.discriminatorMapping && model.schema.discriminatorMapping.isRoot;
}

// Relay resolver decorators
export function mutationWithClientId(mutation) {
	return async ({ input }, context, info) => ({ clientMutationId: input.clientMutationId, ...(await mutation(input, context, info)) })
}
export function subscriptionWithClientId(subscription) {
	return async (args, context, info) => ({ clientSubscriptionId: args.input.clientSubscriptionId, ...(await subscription(args, context, info)) })
}

// Relay connection helpers
export function edge(node, getCursor) {
	return {
		node,
		cursor: String(typeof getCursor === 'function'
			? getCursor(node)
			: node[getCursor])
	};
}
export function connection(nodes, params, getCursor = ({ id }) => id) {
	if (!nodes.length)
		return {
			edges: [],
			pageInfo: {
				startCursor: null,
				endCursor: null,
				hasPreviousPage: false,
				hasNextPage: false
			}
		};
	else
		return {
			edges: nodes.map(node => edge(node, getCursor)),
			pageInfo: {
				startCursor: nodes[0] && getCursor(nodes[0]),
				endCursor: nodes[0] && getCursor(nodes[nodes.length - 1]),
				hasPreviousPage: !!(+params.first - params.last),
				hasNextPage: nodes.length === (+params.first || +params.last)
			}
		};
}

// Handi thangs for serialization
export function toBase64(value) {
	return Buffer.from(String(value), 'utf8').toString('base64');
}
export function fromBase64(value) {
	return Buffer.from(String(value), 'base64').toString('utf-8');
}

export function toNode(doc) {
	return doc && {
		...doc.toObject(),
		_type: doc.constructor.modelName
	};
}

export function slice(array, { first, last, before, after }) {
	if (after) {
		after = fromBase64(after).split(':')[1];
		const index = array.findIndex(({ _id }) => String(_id) === after);
		if (~index)
			array = array.slice(index + 1);
	}
	if (before) {
		before = fromBase64(before).split(':')[1];
		const index = array.findIndex(({ _id }) => String(_id) === before);
		if (~index)
			array = array.slice(0, index);
	}
	const nodes = (first
		? array.slice(0, first)
		: array.slice(last && -last)).map(toNode);
	return {
		edges: nodes.map(node => ({ node, cursor: toBase64(node._id) })),
		pageInfo: {
			hasPreviousPage: !!(last && last == nodes.length),
			hasNextPage: !!(first && first == nodes.length)
		}
	};
}