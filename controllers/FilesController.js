import fs from 'fs';
import sha1 from 'sha1';
import uuidv4 from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const tokenHeader = req.headers['x-token'];
    if (!tokenHeader) return res.status(401).send({ error: 'Unauthorized' });

    const key = `auth_${tokenHeader}`;
    const userIdStringified = await redisClient.get(key);
    if (!userIdStringified) return res.status(401).send({ error: 'Unauthorized' });

    const userIdParsed = parseInt(userIdStringified, 10);

    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!name) return res.status(400).send({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).send({ error: 'Missing type' });
    if (type !== 'folder' && !data) return res.status(400).send({ error: 'Missing data' });

    let parentExists;
    if (parentId) {
      const filesCollection = dbClient.client.db().collection('files');
      parentExists = await filesCollection.findOne({ _id: parentId });
      if (!parentExists) return res.status(400).send({ error: 'Parent not found' });
      if (parentExists.type !== 'folder') return res.status(400).send({ error: 'Parent is not a folder' });
    }

    const newFileId = uuidv4();
    const newFileDocument = {
      _id: newFileId,
      userId: userIdParsed,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
    };

    if (type === 'folder') {
      const filesCollection = dbClient.client.db().collection('files');
      await filesCollection.insertOne(newFileDocument);

      return res.status(201).send(newFileDocument);
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

    const fileContentBuffer = Buffer.from(data, 'base64');
    const filePath = `${folderPath}/${newFileId}`;
    fs.writeFileSync(filePath, fileContentBuffer);

    newFileDocument.localPath = filePath;
    newFileDocument.hashPath = sha1(fileContentBuffer);

    const filesCollection = dbClient.client.db().collection('files');
    await filesCollection.insertOne(newFileDocument);

    delete newFileDocument.localPath;
    delete newFileDocument.hashPath;

    return res.status(201).send(newFileDocument);
  }

  static async getShow(req, res) {
    const tokenHeader = req.headers['x-token'];
    if (!tokenHeader) return res.status(401).send({ error: 'Unauthorized' });

    const key = `auth_${tokenHeader}`;
    const userIdStringified = await redisClient.get(key);
    if (!userIdStringified) return res.status(401).send({ error: 'Unauthorized' });

    const userIdParsed = parseInt(userIdStringified, 10);

    const { id } = req.params;

    const filesCollection = dbClient.client.db().collection('files');
    const fileDocument = await filesCollection.findOne({ _id: id, userId: userIdParsed });
    if (!fileDocument) return res.status(404).send({ error: 'Not found' });

    return res.send(fileDocument);
  }

  static async getIndex(req, res) {
    // Retrieve the user based on the token
    const tokenHeader = req.headers['x-token'];
    if (!tokenHeader) return res.status(401).send({ error: 'Unauthorized' });
    const key = `auth_${tokenHeader}`;
    const userIdStringified = await redisClient.get(key);
    if (!userIdStringified) return res.status(401).send({ error: 'Unauthorized' });
    const userId = parseInt(userIdStringified, 10);

    // Get the parentId from the query string
    let { parentId } = req.query;
    parentId = parentId || null;

    // Get the page number from the query string
    let { page } = req.query;
    page = page || null;

    // Set the limit of items per page
    const limit = 20;
    const filesCollection = dbClient.client.db().collection('files');

    const files = await filesCollection.aggregate([
      { $match: { user: userId, parentId } },
      { $sort: { createdAt: -1 } },
      { $skip: page * limit },
      { $limit: limit },
    ]);

    return res.send(files);
  }
}

module.exports = FilesController;
