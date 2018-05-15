export { toGlobalId, fromGlobalId } from 'graphql-relay';

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
	if (doc.toNode)
		return doc.toNode();
	if (doc.toObject)
		return doc.toObject({ node: true });
	return doc;
}

// Expect array of objects with a cursor prop or get cursor method
export function edge(node) {
	return {
		node,
		cursor: node.cursor,
	};
}
export function connection(nodes, args) {
	return {
		edges: nodes.map(edge),
		pageInfo: {
			startCursor: nodes.length ? nodes[0].cursor : args.after || args.before,
			endCursor: nodes.length ? nodes[nodes.length - 1].cursor : args.before || args.after,
			hasPreviousPage: args.last == nodes.length,
			hasNextPage: args.first == nodes.length,
		},
	};
}
export function slice(nodes, { first, last, before, after }) {
	if (after) {
		const index = nodes.findIndex(node => node.cursor == after);
		if (~index)
			nodes = nodes.slice(index + 1);
	} else if (before) {
		const index = nodes.findIndex(node => node.cursor == before);
		if (~index)
			nodes = nodes.slice(0, index);
	}
	
	if (first)
		return nodes.slice(0, first);
	else
		return nodes.slice(-last);
}
export function page(nodes, args) {
	return connection(slice(nodes, args), args);
}

export function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
