import graphql from 'express-graphql';
import cors from 'cors';
import files from './files';

export default function(options = {}) {
	const graphqlOptions = typeof options.getContext === 'function'
		? async (...args) => ({ ...options, context: await options.getContext(...args) })
		: options;

	return [
		async function(req, res, next) {
			Object.assign(req, options);
			next();
		},
		cors(options),
		files(options),
		graphql(graphqlOptions),
	];
}
