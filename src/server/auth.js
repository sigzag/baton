import { parse } from 'url';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Unauthorized, ExpiredAccessToken } from '../errors';

const defaultAlgorithm = 'aes-256';
const defaultInitVectorLength = 16; // for aes at least...
function keyFromSecret(secret) {
	const hash = createHash('md5');
	hash.update('', 'hex');
	hash.update(secret);
	return hash.digest('hex').slice(0, 32);
}

function encrypt(data, algorithm, key, initVectorLength) {
	const initVector = randomBytes(initVectorLength);
	const cipher = createCipheriv(algorithm, key, initVector);
	return `${initVector.toString('hex')}:${cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex')}`;
}
function decrypt(text, algorithm, key) {
	try {
		const [initVector, data] = text.split(':');
		const decipher = createDecipheriv(algorithm, key, new Buffer(initVector, 'hex'));
		return JSON.parse(decipher.update(data, 'hex', 'utf8') + decipher.final('utf8'));
	} catch (e) {
		throw new Unauthorized('Invalid token');
	}
}

function getToken(req) {
	let token;
	if (req.headers.authorization) {
		if (!req.headers.authorization.startsWith('Bearer '))
			throw new Unauthorized('Format is authorization: Bearer [token]');

		token = req.headers.authorization.slice(7);
	} else {
		token = parse(req.url, true).query['token'];
	}
	
	if (!token)
		throw new Unauthorized('Authorization header missing');

	return token;
}

// Middleware
export function auth({ secret, algorithm = defaultAlgorithm, initVectorLength = defaultInitVectorLength }) {
	const key = keyFromSecret(secret);
	return {
		authenticate(req, res, next) {
			req.token = decrypt(getToken(req), algorithm, key);
			if (req.token.expired)
				throw new ExpiredAccessToken();
			if (next)
				next();
			return req;
		},
		encryptToken(data) {
			return encrypt(data, algorithm, key, initVectorLength);
		}
	};
}
