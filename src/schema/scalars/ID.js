import { GraphQLScalarType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { Kind } from 'graphql/language';
import { fromGlobalId } from 'graphql-relay';

export class RelayID {
	constructor(value) {
		const { type, id } = fromGlobalId(ast.value);
		if (!id || !type)
			throw new Error('Invalid relay id');
		this.type = type;
		this.id = id;
	}
	toString() {
		return this.id;
	}
	toJSON() {
		return this.id;
	}
}
export default new GraphQLScalarType({
	name: 'ID',
	serialize(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) ID');

		return value;
	},
	parseValue(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) ID');
		if (typeof value !== 'string')
			throw new TypeError('Field error: value is an invalid (non-string) ID');

		return new RelayID(ast.value);
	},
	parseLiteral(ast) {
		if (!ast.value)
			throw new GraphQLError(`Query error: Cannot parse null or empty string as ID`, [ast]);
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

		return new RelayID(ast.value);
	}
});