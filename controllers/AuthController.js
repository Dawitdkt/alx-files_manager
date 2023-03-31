const sha1 = require('sha1');
const uuidv4 = require('uuid').v4;
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) return res.status(401).send({ error: 'Unauthorized' });

    const encodedCredentials = authorizationHeader.split(' ')[1];
    if (!encodedCredentials) return res.status(401).send({ error: 'Unauthorized' });

    const credentialsBuffer = Buffer.from(encodedCredentials, 'base64');
    const credentialsString = credentialsBuffer.toString('utf-8');
    const [email, password] = credentialsString.split(':');

    if (!email || !password) return res.status(401).send({ error: 'Unauthorized' });

    const usersCollection = dbClient.client.db().collection('users');
    const userExists = await usersCollection.findOne({ email, password: sha1(password) });
    if (!userExists) return res.status(401).send({ error: 'Unauthorized' });

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, userExists._id.toString(), 86400);

    return res.status(200).send({ token });
  }

  static async getDisconnect(req, res) {
    const tokenHeader = req.headers['x-token'];
    if (!tokenHeader) return res.status(401).send({ error: 'Unauthorized' });

    const key = `auth_${tokenHeader}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).send({ error: 'Unauthorized' });

    await redisClient.del(key);

    return res.status(204).send();
  }
}

module.exports = AuthController;
