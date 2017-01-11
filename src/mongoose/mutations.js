import {
	fromGlobalId
} from 'graphql-relay';

export function addMutation(model, options) {
	return async function(input, context, info) {
		const doc = await model.create(input);
		return {
			[model.modelName]: doc
		};
	}
}
export function updateMutation(model, options) {
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id);
		const doc = await model.findById(id);
		doc.set(input);
		await doc.save();
		return {
			[model.modelName]: doc
		};
	}
}
export function removeMutation(model, options) {
	return async function(input, context, info) {
		const { id } = fromGlobalId(input.id)
		await model.removeById(id);
		return {
			id: input.id
		};
	}
}

export function addToMutation(childModel, parentModel, connectionName, options) {
	const owner = childModel.paths.find(path => path.options && path.options.childPath === connectionName);
	return async function(input, context, info) {
		const { id: parentId } = fromGlobalId(input.parent);
		const { id: childId } = fromGlobalId(input.id);

		const [parent, child] = await Promise.all([
			parentModel.findById(parentId),
			childId
				? childModel.findById(childId)
				: childModel.create(input)
		]);

		if (owner) {
			child.set(owner.name, parent);
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
	const owner = childModel.paths.find(path => path.options && path.options.childPath === connectionName);
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