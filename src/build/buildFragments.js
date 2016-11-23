import {
	values
} from 'lodash';
import {
	toCollectionName
} from 'mongoose/lib/utils';
import {
	GraphQLUnionType
} from 'graphql/type';

function fragments(type, name, indexes) {
	const types = toCollectionName(type);
	return `
		export const ${type}Fragments = fragment => Relay.QL\`
			fragment on viewer {
				${types}(first: 2147483647) @skip(if: $_indexed) {
					edges {
						node {
							id
							${name ? 'name' : ''}
							\${fragment}
						}
					}
				}
				${indexes.map(index => `
					${types}(first: 2147483647 ${index}: $${index}) @include(if: $${index}Search) {
						edges {
							node {
								id
								${name ? 'name' : ''}
								\${fragment}
							}
						}
					}
				`).join('\n')}
			}
		\`;
		${type}Fragments.indexes = ${JSON.stringify(indexes)};
	`;
}
export default function(schema) {
	let output = `import Relay from 'react-relay';`;
	for (let objectType of values(schema.objectTypes))
		output += fragments(
			objectType.name,
			!!~Object.keys(objectType._typeConfig.fields).indexOf('name'),
			objectType.indexes.map(([name]) => name)
		);
	return output;
}