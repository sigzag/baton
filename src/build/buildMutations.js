import {
	values
} from 'lodash';
import {
	toCollectionName
} from 'mongoose/lib/utils';

function capitalize(str) { return str[0].toUpperCase() + str.slice(1); }

function add(type) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	return `
		export class Add${Type} extends Mutation {
			static fragments = {
				viewer: () => Relay.QL\`
					fragment on viewer {
						id
					}
				\`
			};
		
			getMutation() {
				return Relay.QL\`
					mutation {
						Add${Type}
					}
				\`;
			}
			getVariables() {
				return this.props.properties;
			}
			getFatQuery() {
				return Relay.QL\`
					fragment on Add${Type}Payload {
						viewer { ${types} }
						${type}
					}
				\`;
			}
			getConfigs() {
				return [{
					type: 'RANGE_ADD',
					parentName: 'viewer',
					parentID: this.props.viewer.id,
					connectionName: '${types}',
					edgeName: '${type}',
					rangeBehaviors: {
						'': 'append'
					}
				}];
			}
		}
	`;
}
function update(type, properties) {
	const Type = capitalize(type);
	return `
		export class Update${Type} extends Mutation {
			static fragments = {
				node: () => Relay.QL\`
					fragment on ${type} {
						id
					}
				\`
			};
	
			getMutation() {
				return Relay.QL\`
					mutation {
						Update${Type}
					}
				\`;
			}
			getVariables() {
				return {
					id: this.props.node.id,
					...this.props.properties
				};
			}
			getFatQuery() {
				return Relay.QL\`
					fragment on Update${Type}Payload {
						\${this.props.viewer && this.getFragment('viewer')}
						${type} {
							id
							${properties.join('\n')}
						}
					}
				\`;
			}
			getConfigs() {
				return [{
					type: 'FIELDS_CHANGE',
					fieldIDs: {
						node: this.props.node.id
					}
				}];
			}
		}
	`;
}
function remove(type) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	return `
		export class Remove${Type} extends Mutation {
			static fragments = {
				viewer: () => Relay.QL\`
					fragment on viewer {
						id
					}
				\`
			};
		
			getMutation() {
				return Relay.QL\`
					mutation {
						Remove${Type}
					}
				\`;
			}
			getVariables() {
				return {
					id: this.props.node.id
				};
			}
			getFatQuery() {
				return Relay.QL\`
					fragment on Remove${Type}Payload {
						viewer { ${types} }
						id
					}
				\`;
			}
			getConfigs() {
				return [{
					type: 'RANGE_DELETE',
					parentName: 'viewer',
					parentID: this.props.viewer.id,
					connectionName: '${types}',
					deletedIDFieldName: 'id',
					pathConnection: ['viewer', '${types}']
				}]
			}
		}
	`;
}

export default function(schema) {
	let output = `import Relay, { Mutation } from 'react-relay';`;
	for (let objectType of values(schema.objectTypes)) {
		output += add(objectType.name);
		output += update(objectType.name, Object.keys(objectType._typeConfig.fields));
		output += remove(objectType.name);
	}
	return output;
}