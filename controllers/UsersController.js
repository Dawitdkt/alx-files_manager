import sha1 from 'sha1';
import dbClient from '../utils/db';
import { redisClient } from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).send({ error: 'Missing email' });
    if (!password) return res.status(400).send({ error: 'Missing password' });

    const usersCollection = dbClient.client.db().collection('users');
    const userExists = await usersCollection.findOne({ email });
    if (userExists) return res.status(400).send({ error: 'Already exist' });

    const newUser = {
      email,
      password,
      passwordSha1: sha1(password),
    };
    delete newUser.password;

    const result = await usersCollection.insertOne(newUser);
    newUser.id = result.insertedId;

    return res.status(201).send({ email: newUser.email, id: newUser.id });
  }

  static async getMe(req, res) {
    const tokenHeader = req.headers['x-token'];
    if (!tokenHeader) return res.status(401).send({ error: 'Unauthorized' });

    const key = `auth_${tokenHeader}`;
    const userIdStringified = await redisClient.get(key);
    if (!userIdStringified) return res.status(401).send({ error: 'Unauthorized' });

    const userIdParsed = parseInt(userIdStringified, 10);
    const usersCollection = dbClient.client.db().collection('users');
    const userFoundById = await usersCollection.findOne({ _id: userIdParsed },
      { projection: { _id: 0, email: 1 } });

    if (!userFoundById) return res.status(401).send({ error: 'Unauthorized' });

    return res.status(200).send(userFoundById);
  }
}

module.exports = UsersController;
