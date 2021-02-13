/*
  Dependencies
*/
const express = require('express')
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
// const inspect = require('util').inspect;
const Busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const UUID = require('uuid-v4')

/*
  Configuration
*/
const app = express()
const port = 3000
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "quasargram-c0a5a.appspot.com"
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

/*
  Endpoints
*/
app.get('/', (req, res) => {
  res.send('I love node so hard!')
})

app.get('/posts', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  const posts = []
  const snapshot = await db.collection('posts').orderBy('date', 'desc').get();
  snapshot.forEach((doc) => {
    posts.push(doc.data())
  });
  res.status(200).json(posts)
})

app.post('/createPosts', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  const uuid = UUID();
  var busboy = new Busboy({ headers: req.headers });

  let fields = {}
  let fileData = {}
  busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
    // file temp -> /temp/uniqId.png 
    let filePath = path.join(os.tmpdir(), filename)
    file.pipe(fs.createWriteStream(filePath))
    fileData = { filePath, mimetype }
  });

  busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    fields[fieldname] = val
  });

  busboy.on('finish', async function () {
    const { filePath, mimetype } = fileData
    bucket.upload(
      filePath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: mimetype,
            firebaseStorageDownloadTokens: uuid
          }
        }
      },
      (err, uploadedFile) => {
        createDoc(uploadedFile)
      }
    )

    const createDoc = async (uploadedFile) => {
      try {
        const { id, caption, location, date } = fields
        const result = await db.collection('posts').doc(id).set({
          id,
          caption,
          location,
          date: parseInt(date),
          imgUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`
        });
        res.send(`Posted Successfully ${id}`);
      } catch (err) {
        console.log(err);
      }
    }
  });
  req.pipe(busboy);
})


/*
  Listening PORT
*/
app.listen(process.env.PORT || port, () => {
  console.log(`your app listening at http://localhost:${port}`)
})