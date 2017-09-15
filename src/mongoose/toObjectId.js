import mongoose from 'mongoose';
import { fromGlobalId } from 'graphql-relay';

export default function toObjectId(id) {
	if (id.id)
		id = id.id;
	if (id instanceof mongoose.Schema.Types.ObjectId)
		return id;
	if (mongoose.Types.ObjectId.isValid(id))
		return mongoose.Types.ObjectId(id);
	if (fromGlobalId(id))
		return mongoose.Schema.Types.ObjectId(fromGlobalId(id).id);
	return id;
}