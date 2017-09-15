import graphql from 'express-graphql';
import accessControl from './accessControl';
import files from './files';

export default function(options) {
	return [
		accessControl(options),
		files(options),
		graphql(options)
	];
}