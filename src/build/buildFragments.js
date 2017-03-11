import {
	values
} from 'lodash';
import {
	toCollectionName
} from 'mongoose/lib/utils';
import {
	GraphQLUnionType
} from 'graphql/type';

function capitalize(str) { return str[0].toUpperCase() + str.slice(1); }

function fragment(type, hasName) {
	return `
export const get${capitalize(toCollectionName(type))} = Component => {
	if (Component && Component.fragments && Component.fragments.node)
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647) { edges { node { id ${hasName ? 'name' : ''} __typename \${Component.getFragment('node')} } } } }\`;
	else if (Component && Component.fragments && Component.fragments.viewer)
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647) { edges { node { id ${hasName ? 'name' : ''} __typename } } } \${Component.getFragment('viewer')} }\`;
	else
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647) { edges { node { id ${hasName ? 'name' : ''} __typename } } } }\`;
}`;
}
function indexedFragment(type, hasName, index) {
	return `
export const get${capitalize(toCollectionName(type))}By${capitalize(index)} = Component => {
	if (Component && Component.fragments && Component.fragments.node)
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647 ${index}: $${index}) { edges { node { id ${hasName ? 'name' : ''} __typename \${Component.getFragment('node')} } } } }\`;
	if (Component && Component.fragments && Component.fragments.viewer)
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647 ${index}: $${index}) { edges { node { id ${hasName ? 'name' : ''} __typename } } } \${Component.getFragment('viewer')} }\`;
	else
		return Relay.QL\`fragment on viewer { ${toCollectionName(type)}(first: 2147483647 ${index}: $${index}) { edges { node { id ${hasName ? 'name' : ''} __typename } } } }\`;
}`;
}

export default function(schema) {
	let output = `import Relay from 'react-relay';`;
	for (let objectType of values(schema.objectTypes)) {
		const hasName = !!~Object.keys(objectType._typeConfig.fields).indexOf('name');
		output += fragment(objectType.name, hasName);
		for (let [index] of objectType.indexes)
			output += indexedFragment(objectType.name, hasName, index);
	}
	return output;
}