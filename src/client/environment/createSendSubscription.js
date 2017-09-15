if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

let counter = 0;

export default function(uri, token) {
	let connectionAttempts = 0;
	const connectionIntervals = [500, 3000, 4000];
	const defaultConnectionInvterval = 500;
	
	const subscriptions = {};
	
	let socket;
	
	function connect() {
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
	
		if (++connectionAttempts >= connectionIntervals.length) {
			connectionAttempts = 0;
			return console.warn('Gave up trying to reconnect websocket after ' + connectionAttempts + ' tries.');
		}
		
		socket = new WebSocket(`${uri.replace(/^https?/, 'ws')}${token ? `?jwt_token=${token}` : ''}`);
		socket.onopen = onconnect;
		socket.onmessage = onmessage;
		socket.onclose = onclose;
		socket.onerror = onerror;
	}
	
	function onconnect() {
		connectionAttempts = 0;
		for (let id in subscriptions)
			sendSubscription(
				subscriptions[id].operation,
				subscriptions[id].variables,
				subscriptions[id].cacheConfig,
				subscriptions[id].observer
			);
	}
	function onclose() {
		socket = null;
		setTimeout(
			connect,
			connectionIntervals[connectionAttempts] || defaultConnectionInvterval
		);
	}
	function onerror(e) {
		console.log('err', e.data);
	}
	function onmessage(e) {
		try {
			const { id, data, errors } = JSON.parse(e.data);
			const { observer } = subscriptions[id];
			if (!observer)
				return;
			else if (errors)
				observer.onError && observer.onError(errors);
			else
				observer.onNext && observer.onNext({ data });
		} catch (e) {
			throw new Error(e);
		}
	}
	
	connect();
	return function sendSubscription(
		operation,
		variables,
		cacheConfig,
		observer
	) {
		const id = variables.input.clientSubscriptionId = `clientSubscriptionId:${counter++}`
		subscriptions[id] = { operation, variables, cacheConfig, observer };
		socket.send(JSON.stringify({
			type: 'subscribe',
			data: {
				id,
				queryString: operation.text,
				variables
			}
		}));
	
		return {
			dispose() {
				socket.send(JSON.stringify({
					type: 'unsubscribe',
					data: id
				}));
				delete subscriptions[id];
			}
		};
	}
}