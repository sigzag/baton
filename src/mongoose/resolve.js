import { connection as connectionOutput } from '../util';

// Object resolvers
export function object(model, name) {
	return function(rootValue, args, context, info) {
		return model.findById(rootValue[name]);
	}
}
export function objects(model, name) {
	return async function(rootValue, args, context, info) {
		return model.find({ _id: { $in: rootValue[name] || [] } });
	}
}
export function connection(model, name) {
	return async function(rootValue, args, context, info) {
		const { before, after, first, last, sort, ...query } = args;

		if (after)
			query._id = { ...(query._id || {}), $gt: after };
		if (before)
			query._id = { ...(query._id || {}), $lt: before };

		const docs = await model.find(query, null, {
			skip: (first - last) || 0,
			limit: last || first,
			sort: sort
				? { ...sort, _id: 1 }
				: '_id'
		});

		return connectionOutput(docs, args, ({ id }) => id);
	}
}