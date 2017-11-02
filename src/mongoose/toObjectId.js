import mongoose from 'mongoose';
import { fromGlobalId } from 'graphql-relay';

export default function toObjectId(id) {
	id = id.id || id._id || id;
	if (id instanceof mongoose.Types.ObjectId)
		return id;
	if (mongoose.Types.ObjectId.isValid(id))
		return mongoose.Types.ObjectId(id);
	if (fromGlobalId(id))
		return mongoose.Types.ObjectId(fromGlobalId(id).id);
	return id;
}