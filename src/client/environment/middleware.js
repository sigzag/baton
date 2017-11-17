import { Observable } from 'relay-runtime';
import Backoff from 'backo';

// Key functionality
export function sendSubsription({ min = 100, max = 20000 }) {
	const sockets = {};
	const subscriptions = {};
	const backoff = new Backoff({ min, max });

	// Socket listeners
	function onopen() {
		backoff.reset();
		socket.onmessage = onmessage;
		socket.onclose = onclose;
		for (let id in subscriptions)
			sendSubscribeMessage(id);
	}
	function onmessage(event) {
		const { id, data, errors } = JSON.parse(event.data);
		if (id in subscriptions) {
			const { sink } = subscriptions[id];
			if (errors) {
				sink.error(errors);
			} else {
				sink.next({ data });
			}
		}
	}
	function onclose(event) {
		setTimeout(() => connect(this.url), backoff.duration);
		delete sockets[this.url];
	}
	function onerror(error) {
		for (let id in subscriptions)
			subscriptions[id].sink.error();
	}

	// Connect
	function connect(host) {
		if (sockets[host]) {
			return;
		}
		
		sockets[host] = new WebSocket(subscription.host);
		sockets[host].onopen = onopen;
		sockets[host].onclose = onerror;
	}

	// Sub/unsub messages
	function sendSubscribeMessage(id) {
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
	function sendUnsubscribeMessage(id) {
		socket.send(JSON.stringify({
			type: 'unsubscribe',
			data: {
				id,
			},
		}));
	}

	return function sendSubscription(subscription) {
		return new Observable(async (sink) => {
			subscription.sink = sink;
			subscriptions[subscription.id] = subscription;
			
			if (socket)
				sendSubscribeMessage(subscription.id);
			else
				connect();
		
			return () => {
				sink.unsubscribe();
				delete subscription[subscription.id];
				sendUnsubscribeMessage(subscription.id);
			};
		});
	};
}
export function sendQuery() {
	return function sendQuery({ operation, variables, uploadables, host, context }) {
		return Observable.create(async function(sink) {
			if (variables.hasOwnProperty('input'))
				variables.input.clientMutationId = `clientMutationId:${counter++}`;
			
			const body = new FormData();
			if (uploadables) {
				for (let key in uploadables) {
					body.append(key, {
						uri: uploadables[key].uri,
						type: uploadables[key].type,
						name: uploadables[key].name || 'test.jpeg',
					});
				}
			}
			body.append('variables', JSON.stringify(variables));
			body.append('query', operation.text);
	
			const response = await fetch(host, {
				...context,
				body,
			});
	
			if (response.status !== 200) {
				sink.error(await response.text());
			} else {
				sink.next(await response.json());
				sink.complete();
			}
		});
	}
}

// We like AUTHENTIC behaviours
export function authHeader(token) {
	return (query, forward) => Observable.create(async (sink) => {
		query.context.headers.authorization = `Bearer ${await token()}`;
		forward(query).subscribe(sink);
	});
}
export function authQuerystring(token) {
	return (query, forward) => Observable.create(async (sink) => {
		query.host += `?token=${await token()}`;
		forward(query).subscribe(sink);
	});
}

// Errors aren't neccessarily the end of the world
export function retryOnError(fn) {
	return (query, forward) => Observable.create((sink) => forward(query).subscribe({
		...sink,
		async error() {
			await fn();
			forward(query).subscribe(sink);
		}
	}));
}
export function callOnError(fn) {
	return (query, forward) => Observable.create((sink) => forward(query).subscribe({
		...sink,
		async error(...args) {
			await fn();
			sink.error(...args);
		}
	}));
}

// Maybe there's some data there already?
export function cache({ get, set }) {
	return (query, forward) => Observable.create((sink) => {
		const cached = get(query.id, query.variables);
		if (cached)
			sink.next(cached);

		forward(query).subscribe({
			...sink,
			next(data) {
				cache.set(query.id, query.variables, data);
				sink.next(data);
			},
		});
	});
}

// Waaaait for it
export function waitFor(fn) {
	return (query, forward) => Observable.create(async (sink) => {
		await fn();
		forward(query).subscribe(sink);
	});
}

// Without this the whole thang falls apart
export function withHost(host) {
	return (query, forward) => forward({ ...query, host });
}

// And exxxecute
export function executeStack(stack, query) {
	const forwarders = stack.map((middleware, i) => (query) => middleware(query, forwarders[i + 1]));
	return stack[0](query, forwarders[0]);
}

/*

How I imagine a middleware stack might look for

fetchQuery:
	withHost(host), authHeader(token fn), cache({ get, set }), callOnError(logout), retryOnError(refresh), waitFor(online), sendQuery

sendSubscription:
	withHost(host), authQuerystring(token fn), callOnError(logout), retryOnError(refresh), waitFor(online), sendSubsription({ min, max, etc... })

*/
