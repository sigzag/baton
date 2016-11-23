import { DefaultNetworkLayer } from 'react-relay';
if (!window.navigator.userAgent)
	window.navigator.userAgent = 'ReactNative';

export class SubscribableNetworkLayer extends DefaultNetworkLayer {
	constructor(host, token) {
		super(host, { mode: 'cors', headers: {} });
		this.requests = {};	
		this._initSocket(token);
	}

	setToken(token) {
		this._init.headers.Authorization = `Bearer ${token}`;
		this._initSocket(token);
	}

	_initSocket(token) {
		if (this.socket)
			this.socket.close();
		
		this.socket = new WebSocket(`${this._uri.replace(/^https?/, 'ws')}${token ? `?jwt_token=${token}` : ''}`);
		this.socket.onopen = this.onConnect;
		this.socket.onmessage = this.onMessage;
	}

	onConnect() {
		for (let id in this.requests)
			this.sendSubscription(this.requests[id]);
	}
	onMessage(message) {
		const { id, data, errors } = JSON.parse(message);
		const request = this.requests[id];
		if (errors)
			request.onError(errors);
		else
			request.onNext(data);
	}
	onConnect = this.onConnect.bind(this);
	onMessage = this.onMessage.bind(this);

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