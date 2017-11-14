if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

let counter = 0;
export default function(host, token, options = {}) {
	const {
		connectionIntervals = [500, 3000, 4000],
		defaultConnectionInterval = 500,
	} = options;
	
	let socket;
	let connectionAttempts = 0;
	const subscriptions = {};
	
	async function connect() {
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
	
		if (++connectionAttempts >= connectionIntervals.length) {
			connectionAttempts = 0;
			return console.warn('Gave up trying to reconnect websocket after ' + connectionAttempts + ' tries.');
		}

		const tokenValue = typeof token === 'function' ? await token() : token;
		const hostValue = typeof host === 'function' ? await host() : host;
		
		socket = new WebSocket(`${hostValue}${tokenValue ? `?token=${tokenValue}` : ''}`);
		socket.onopen = onopen;
		socket.onmessage = onmessage;
		socket.onclose = onclose;
		socket.onerror = onerror;
	}
	
	function onopen() {
		connectionAttempts = 0;
		for (let subscriptionID in subscriptions)
			_sendSubscription(subscriptionID);
	}
	function onclose() {
		socket = null;
		setTimeout(connect, connectionIntervals[connectionAttempts] || defaultConnectionInterval);
	}
	function onerror(e) {
		console.log('err', e.data);
		// and then what?
	}
	function onmessage(e) {
		const { id, data, errors } = JSON.parse(e.data);
		if (id in subscriptions) {
			const { observer } = subscriptions[id];
			if (errors)
				observer.onError(errors);
			else
				observer.onNext({ data });
		}
	}

	function _sendSubscription(id) {
		if (id in subscriptions) {
			const { operation, variables, cacheConfig } = subscriptions[id];
			socket.send(JSON.stringify({
				type: 'subscribe',
				data: {
					id,
					variables,
					queryString: operation.text,
				},
			}));
		}
	}

	return function sendSubscription(
		operation,
		variables,
		cacheConfig,
		observer
	) {
		const id = `clientSubscriptionId:${operation.id}${counter++}`;
		subscriptions[id] = {
			operation,
			variables: {
				...variables,
				input: {
					...variables.input,
					clientSubscriptionId: 
				},
			},
			cacheConfig,
			observer,
		};
	
		if (socket)
			_sendSubscription(id);
		else
			connect();
	
		return {
			dispose() {
				console.log('disposing of subscription', id);
				if (socket)
					socket.send(JSON.stringify({
						type: 'unsubscribe',
						data: id
					}));
				delete subscriptions[id];
			}
		};
	}
}