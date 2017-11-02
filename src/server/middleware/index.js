import graphql from 'express-graphql';
import accessControl from './accessControl';
import files from './files';

export default function(options = {}) {
	return [
		function(req, res, next) {
			Object.assign(req, options);
			next();
		},
		accessControl(options),
		files(options),
		graphql(options)
	];
}