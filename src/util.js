import { toPairs, isPlainObject, mapValues, curryRight } from 'lodash';
import { toGlobalId, fromGlobalId } from 'graphql-relay';

export { toGlobalId, fromGlobalId };

// Relay resolver decorators
export function mutationWithClientId(mutation) {
	return async ({ input }, context, info) => ({ clientMutationId: input.clientMutationId, ...(await mutation(input, context, info)) })
}
export function subscriptionWithClientId(subscription) {
	return async ({ input }, context, info) => ({ clientSubscriptionId: input.clientSubscriptionId, ...(await subscription(input, context, info)) })
}

// Curried versions

export const mutationsWithClientId = curryRight(mapValues)(mutationWithClientId);
export const subscriptionsWithClientId = curryRight(mapValues)(subscriptionWithClientId);

// Relay connection helpers
export function edge(node, getCursor = ({ id }) => id) {
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
				startCursor: params.before,
				endCursor: params.after,
				hasPreviousPage: false,
				hasNextPage: false,
			}
		};
	else
		return {
			edges: nodes.map(node => edge(node, getCursor)),
			pageInfo: {
				startCursor: params.before || nodes[0] && getCursor(nodes[0]),
				endCursor: params.after || nodes[0] && getCursor(nodes[nodes.length - 1]),
				hasPreviousPage: !!(params.last && params.last == nodes.length),
				hasNextPage: !!(params.first && params.first == nodes.length),
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
	if (!doc)
		return null;

	if (!doc.toObject)
		return doc;

	if (doc.toNode)
		return doc.toNode();

	return doc.toObject({ node: true });
}

export function slice(array, { first, last, before, after }, compare = ({ id }, cursor) => id === cursor) {
	if (after) {
		const index = array.findIndex(node => compare(node, after));
		if (~index)
			array = array.slice(index + 1);
	}
	if (before) {
		const index = array.findIndex(node => compare(node, before));
		if (~index)
			array = array.slice(0, index);
	}
	return (first
		? array.slice(0, first)
		: array.slice(last && -last)
	).map(toNode);
}
export function page(nodes, { first, last }, getCursor = ({ id }) => id) {
	return {
		edges: nodes.map(node => ({ node, cursor: getCursor(node) })),
		pageInfo: {
			startCursor: nodes.length ? getCursor(nodes[0]) : null,
			endCursor: nodes.length ? getCursor(nodes[nodes.length - 1]) : null,
			hasPreviousPage: last === nodes.length,
			hasNextPage: first === nodes.length
		}
	};
}

export function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}