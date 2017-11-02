import jwt from 'jsonwebtoken';
import { toPairs, isPlainObject, mapValues, curryRight } from 'lodash';

export function parseToken(token, secret) {
	if (!token) {
		return Promise.reject(new Error('Missing credentials', { message: 'Missing token' }));
	}

	return new Promise((resolve, reject) =>
		jwt.verify(token, secret, (err, data) => (
			err
				? reject(new Error('Invalid token', { message: err }))
				: resolve(data)
		))
	);
}
export function parseURL(url, secret) {
	const token = (url.match(/jwt_token\=([^&]+)/) || [])[1];
	if (!token)
		throw new Error('No authorization header', { message: 'Authorization header missing' });
	
	return parseToken(token, secret);
}
export function parseHeaders(headers, secret) {
	if (!headers || !headers.authorization) {
		throw new Error('No authorization header', { message: 'Authorization header missing' });
	}
	
	const [scheme, token] = headers.authorization.split(' ');
	if (scheme !== 'Bearer') {
		throw new Error('Bad credentials', { message: 'Format is authorization: Bearer [token]' });
	}
	
	return parseToken(token, secret);
}

// Middleware
export function authMiddleware(options = {}) {
	const { secret, url } = options;
	return async function auth(req, res, next) {
		try {
			req.user = await (url
				? parseURL(req.url, secret)
				: parseHeaders(req.headers, secret)
			);
		} catch (e) {
			req.authError = e;
		}
		next();
	};
}

// Root value authenticators
export function authenticateQuery(query) {
	return function queryAuthenticator(args, context, ...rest) {
		if (context.authError) {
			throw context.authError;
		}

		return query(args, context, ...rest);
	};
}
export function authenticateSubscription(subscription) {
	return function subscriptionAuthenticator(args, context, info) {
		if (context.authError) {
			throw context.authError;
		}

		return subscription(args, context, info);
	};
}

// Curried versions
export const authenticateQueries = curryRight(mapValues)(authenticateQuery);
export const authenticateSubscriptions = curryRight(mapValues)(authenticateSubscription);

// Signing token
export function signToken(data, secret) {
	return jwt.sign(data, secret);
}

// Encrypting password somewhat standardly for once
export function encryptPassword(/* password */) {

}
