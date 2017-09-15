import {
	ConnectionHandler,
	ViewerHandler
} from 'relay-runtime';

const ObjectHandler = {
	update(proxy, payload) {
		const record = proxy.get(payload.dataID);
		if (!record)
			return;

		record._mutator.setValue(payload.dataID, record.getValue(payload.fieldKey), payload.handleKey);
	}
}

export default function(options) {
	return function handlerProvider(handle) {
		switch (handle) {
			case 'connection': return ConnectionHandler;
			case 'viewer': return ViewerHandler;
			case 'object': return ObjectHandler;
		}
		throw new Error(
			`handlerProvider: No handler provided for ${handle}`
		);
	}
}