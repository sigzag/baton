import { DefaultNetworkLayer } from 'react-relay';
if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

export class SubscribableNetworkLayer extends DefaultNetworkLayer {
	constructor(host, token) {
		super(host, { mode: 'cors', headers: {} });
		this.requests = {};	
		this.setToken(token);
	}

	setToken(token) {
		this._token = token;
		this._init.headers.Authorization = `Bearer ${token}`;
		this._initSocket();
	}

	connectionAttempts = 0;
	connectionIntervals = [500, 3000, 4000];
	defaultConnectionInvterval = 500;

	_initSocket() {
		if (this.socket) {
			this.socket.onclose = null;
			this.socket.close();
		}

		if (++this.connectionAttempts >= this.connectionIntervals.length) {
			this.connectionAttempts = 0;
			return console.warn('Gave up trying to reconnect websocket after ' + this.connectionAttempts + ' tries.');
		}
		
		const token = this._token;
		this.socket = new WebSocket(`${this._uri.replace(/^https?/, 'ws')}${token ? `?jwt_token=${token}` : ''}`);
		this.socket.onopen = this.onConnect;
		this.socket.onmessage = this.onMessage;
		this.socket.onclose = this.onClose;
		this.socket.onerror = this.onError;
	}

	onConnect = () => {
		this.connectionAttempts = 0;
		for (let id in this.requests)
			this.sendSubscription(this.requests[id]);
	};
	onMessage = e => {
		const { id, data, errors } = JSON.parse(e.data);
		const request = this.requests[id];
		if (errors)
			request.onError(errors);
		else
			request.onNext(data);
	};
	onClose = () => {
		this.socket = null;
		setTimeout(
			() => this._initSocket(),
			this.connectionIntervals[this.connectionAttempts] || this.defaultConnectionInvterval
		);
	};
	onError = e => {
		console.log('err', e.data);
	};

	errorHandler = e => {
		console.log(e);
		throw e;
	}

	sendMutation(mutationRequest) {
		return super.sendMutation(mutationRequest)
			.catch(this.errorHandler);
	}
	sendQueries(queryRequests) {
		return super.sendQueries(queryRequests)
			.catch(this.errorHandler);
	}

	sendSubscription(request) {
		const id = request.getClientSubscriptionId();
		this.requests[id] = request;
		this.socket.send(JSON.stringify({
			type: 'subscribe',
			data: {
				id,
				queryString: request.getQueryString(),
				variables: request.getVariables()
			}
		}));
	
		return {
			dispose: () => {
				this.socket.send(JSON.stringify({
					type: 'unsubscribe',
					data: id
				}));
				delete this.requests[id];
			}
		};
	}
}