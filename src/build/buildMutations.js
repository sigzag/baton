import {
	values,
	toPairs
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
	static fragments = { viewer: () => Relay.QL\`fragment on Viewer { id }\` };
	getMutation = () => Relay.QL\` mutation { Add${Type} } \`;
	getVariables = () => this.props.properties;
	getFatQuery = () => Relay.QL\`fragment on Add${Type}Payload { viewer { ${types} } ${type} }\`;
	getConfigs = () => [{
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
	`;
}
function update(type, properties) {
	const Type = capitalize(type);
	return `
export class Update${Type} extends Mutation {
	static fragments = { node: () => Relay.QL\`fragment on ${Type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Update${Type} }\`;
	getVariables = () => ({ id: this.props.node.id, ...this.props.properties });
	getFatQuery = () => Relay.QL\`fragment on Update${Type}Payload { \${this.props.viewer && this.getFragment('viewer')} ${type} }\`;
	getOptimisticResponse = () => ({ ${type}: this.getVariables() })
	getConfigs = () => [{
		type: 'FIELDS_CHANGE',
		fieldIDs: {
			node: this.props.node.id
		}
	}];
}
	`;
}
function delete(type) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	return `
export class Remove${Type} extends Mutation {
	static fragments = { viewer: () => Relay.QL\`fragment on Viewer { id }\`, node: () => Relay.QL\`fragment on ${Type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Remove${Type} }\`;
	getVariables = () => ({ id: this.props.node.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Type}Payload { viewer { ${types} } id }\`;
	getOptimisticResponse = this.getVariables;
	getConfigs = () => [{
		type: 'NODE_DELETE',
		parentName: 'viewer',
		parentID: this.props.viewer.id,
		connectionName: '${types}',
		deletedIDFieldName: 'id'
	}];
}
	`;
}

function addTo(type, parentType, connectionName) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	const ParentType = capitalize(parentType);
	return `
export class Add${capitalize(connectionName)}To${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${ParentType} { id }\` };
	getMutation = () => Relay.QL\` mutation { Add${Type}To${ParentType} } \`;
	getVariables = () => this.props.id
		? { parent: this.props.parent.id, id: this.props.id }
		: { parent: this.props.parent.id, ...this.props.properties };
	getFatQuery = () => Relay.QL\`fragment on Add${Type}To${ParentType}Payload { parent { ${connectionName} } child }\`;
	getConfigs = () => [{
		type: 'RANGE_ADD',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		edgeName: 'child',
		rangeBehaviors: {
			'': 'append'
		}
	}];
}
	`;
}
function removeFrom(type, parentType, connectionName) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	const ParentType = capitalize(parentType);
	return `
export class Remove${capitalize(connectionName)}From${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${ParentType} { id }\`, node: () => Relay.QL\`fragment on ${Type} { id }\` };
	getMutation = () => Relay.QL\`mutation { Remove${Type}From${ParentType} }\`;
	getVariables = () => ({ parent: this.props.parent.id, id: this.props.node.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Type}From${ParentType}Payload { parent { ${types} } id }\`;
	getOptimisticResponse = this.getVariables;
	getConfigs = () => [{
		type: 'RANGE_DELETE',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		deletedIDFieldName: 'id',
		pathConnection: ['viewer', '${connectionName}']
	}];
}
	`;
}
function deleteFrom(type, parentType, connectionName) {
	const types = toCollectionName(type);
	const Type = capitalize(type);
	const ParentType = capitalize(parentType);
	return `
export class Remove${capitalize(connectionName)}From${ParentType} extends Mutation {
	static fragments = { parent: () => Relay.QL\`fragment on ${ParentType} { id }\`, node: () => Relay.QL\`fragment on ${Type} { id }\`  };
	getMutation = () => Relay.QL\`mutation { Remove${Type}From${ParentType} }\`;
	getVariables = () => ({ parent: this.props.parent.id, id: this.props.${type}.id });
	getFatQuery = () => Relay.QL\` fragment on Remove${Type}From${ParentType}Payload { parent { ${types} } id }\`;
	getOptimisticResponse = this.getVariables;
	getConfigs = () => [{
		type: 'NODE_DELETE',
		parentName: 'parent',
		parentID: this.props.parent.id,
		connectionName: '${connectionName}',
		deletedIDFieldName: 'id'
	}];
}
	`;
}

export default function(schema) {
	let output = `import Relay, { Mutation } from 'react-relay';`;
	for (let objectType of values(schema.objectTypes)) {
		output += add(objectType.name);
		output += update(objectType.name, Object.keys(objectType._typeConfig.fields));
		output += delete(objectType.name);
		for (let [_, field] of toPairs(objectType.fields)) {
			const connection = schema.connectionDefinitions.find(({ connectionType }) => field.type === connectionType);
			if (connection) {
				output += addTo(connection.edgeType.name, objectType.name, field.name);
				if (objectType._typeConfig.fields[field.name].owner)
					output += deleteFrom(connection.edgeType.name, objectType.name, field.name);
				else
					output += removeFrom(connection.edgeType.name, objectType.name, field.name);
			}
		}
	}
	return output;
}