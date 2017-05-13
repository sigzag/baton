import {
	fromGlobalId
} from 'graphql-relay';
import {
	values,
	omit
} from 'lodash';

function resolveIdFields(input, idFields) {
	return omit(idFields.reduce((input, field) => input[field]
		? {
			...input,
			[field]: Array.isArray(input[field])
				? input[field].map(id => fromGlobalId(id).id)
				: fromGlobalId(input[field]).id
		} : input, input), ['id', 'clientMutationId', 'parent']);
}

export function addMutation(model, options) {
	const idFields = values(model.schema.paths)
		.filter(path => path.options && path.options.ref)
		.map(field => field.path);
	return function(input, context, info) {
		return model.create(resolveIdFields(input, idFields));
	}
}
export function updateMutation(model, options) {
	const idFields = values(model.schema.paths)
		.filter(path => path.options && path.options.ref)
		.map(field => field.path);
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		const doc = await model.findById(id);

		doc.set(resolveIdFields(input, idFields));
		await doc.save();

		return doc;
	}
}
export function removeMutation(model, options) {
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		const doc = await model.findById(id);

		await doc.remove();
		
		return {
			id: input.id
		};
	}
}

export function addToMutation(childModel, parentModel, connectionName, options) {
	const owner = values(childModel.schema.paths)
		.find(path => path.options && path.options.childPath === connectionName);
	const idFields = values(childModel.schema.paths)
		.filter(path => path.options && path.options.ref)
		.map(field => field.path);
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);
		
		const [parent, child] = await Promise.all([
			parentModel.findById(parentId),
			input.id
				? childModel.findById(fromGlobalId(input.id).id)
				: childModel.create(resolveIdFields(input, idFields))
		]);

		if (owner) {
			child.set(owner.path, parent);
			await child.save();
		}

		parent[connectionName].addToSet(child);
		await parent.save();

		return {
			parent,
			child
		};
	}
}
export function removeFromMutation(childModel, parentModel, connectionName, options) {
	const owner = values(childModel.schema.paths)
		.find(path => path.options && path.options.childPath === connectionName);
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);
		const { id: childId } = fromGlobalId(input.id);

		const [parent, child] = await Promise.all([
			parentModel.findById(parentId),
			childModel.findById(childId)
		]);

		parent[connectionName].pull(child);
		await Promise.all([
			parent.save(),
			owner && child.remove()
		]);

		return {
			parent,
			id: input.id
		};
	}
}

export function updateInArrayMutation(parentModel, connectionName, options) {
	// const idFields = values(childModel.schema.paths)
	// 	.filter(path => path.options && path.options.ref)
	// 	.map(field => field.path); // not correct, issit
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		
		const parent = await model.find({ [`${connectionName}._id`]: id });
		const child = parent[connectionName].id(id);

		child.set(resolveIdFields(input, idFields));
		parent.markModified(connectionName);
		await parent.save();

		return child;
	}
}
export function addToArrayMutation(parentModel, connectionName, options) {
	// const idFields = values(childModel.schema.paths)
	// 	.filter(path => path.options && path.options.ref)
	// 	.map(field => field.path); // ditto
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);

		const parent = await parentModel.findById(parentId);
		const child = parent[connectionName].create(resolveIdFields(input, idFields));
		parent[connectionName].addToSet(child);
		await parent.save();

		return {
			parent,
			child
		};
	}
}
export function removeFromArrayMutation(schema, parentModel, connectionName, options) {
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);
		const { id: childId } = fromGlobalId(input.id);

		const parent = await parentModel.findById(parentId);
		const child = parent[connectionName].id(childId);
		parent[connectionName].pull(child);
		await parent.save();

		return {
			parent,
			id: input.id
		};
	}
}