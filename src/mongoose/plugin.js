import mongoose from 'mongoose';
import { toBase64 } from 'relay-baton/util';
import { connection } from 'relay-baton/mongoose/resolve';

const toObject = mongoose.Document.prototype.toObject;
const resolve = Symbol();

export function resolveNode(node) {
	return node && node.constructor && node.constructor.resolveNode
		? node.constructor.resolveNode(node)
		: node;
}

export default function(schema, options = {}) {
	schema.statics.resolve = async function(args, query = {}) {
		const result = await connection(this)(void 0, {
			before: args.before,
			after: args.after,
			first: args.first,
			last: args.last,
			sort: args.sort,
			...query,
			...(typeof options.query === 'function'
				? options.query(args, query)
				: options.query || {})
		});
		return {
			...result,
			edges: result.edges.map(edge => ({ ...edge, node: resolveNode(edge.node) }))
		};
	}
	schema.statics.resolveNode = function(doc) {
		const node = doc.toObject();
		for (let path in transforms)
			node[path] = transforms[path](doc);
		return node;
	}

	const transforms = Object.keys(schema.paths).reduce((transforms, path) => {
		const isArray = schema.paths[path].caster;
		const { node, list, connection, query } = (isArray
			? schema.paths[path].caster.options
			: schema.paths[path].options) || {};

		if (connection)
			transforms[path] = doc => (args, context) =>
				mongoose.model(connection).resolve(args, { _id: { $in: doc.get(path) || [] } });
		else if (list)
			transforms[path] = doc => mongoose.model(list).find({ _id: { $in: doc.get(path) || [] } }).then(docs => docs.map(resolveNode));
		else if (node)
			transforms[path] = doc => doc.get(path) instanceof mongoose.model(node)
				? resolveNode(doc.get(path))
				: mongoose.model(node).findById(doc.get(path)).then(resolveNode);
		else if (schema.paths[path].caster && schema.paths[path].caster.resolveNode)
			transforms[path] = doc => doc.get(path) ? schema.paths[path].caster.resolveNode(doc.get(path)) : node;

		return transforms;
	}, {
		__typename: doc => options.typename,
		id: doc => toBase64(`${options.typename}:${doc._id}`),
		...(options.virtual || {})
	});
}