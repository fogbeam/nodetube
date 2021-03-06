const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs-extra'));
const FileType = require('file-type');
const webp = require('webp-converter');
const youtubedl = require('youtube-dl');
const spawn = require('child_process').spawn;
const mongoose = require('mongoose');



const requestModule = require('request');
const request = Promise.promisifyAll(requestModule);
const _ = require('lodash');
const dotenv = require('dotenv');

const mkdirp = Promise.promisifyAll(require('mkdirp'));

// turn off for now, still need that file
// const downloader = require('./downloadBinary');

const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

console.log(`ffmpeg path: ${ffmpegPath}`);

const youtubeBinaryFilePath = youtubedl.getYtdlBinary();

console.log(`youtube-dl binary path: ${youtubeBinaryFilePath}`);


const databasePath = process.env.MONGODB_URI || process.env.MONGOLAB_URI || 'mongodb://localhost:27017/nodetubeaug18'
console.log('DATABASE: ' + databasePath);

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;

mongoose.Promise = global.Promise;
mongoose.connect(databasePath, {
  keepAlive: true,
  reconnectTries: Number.MAX_VALUE,
  useMongoClient: true
});

// mongoose.set('debug', true);


mongoose.connection.on('error', (err) => {
  console.error(err);
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  process.exit();
});

console.log('Connected to ' + databasePath);

process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception: `, err);
  console.log(err.stack);
});
process.on('unhandledRejection', (err) => {
  console.log(`Unhandled Rejection: `, err);
  console.log(err.stack);
});





const randomstring = require('randomstring');
const Upload = require('../../models/index').Upload;
const User = require('../../models/index').User;




/** download and save thumbnails locally **/
async function downloadAndSaveThumbnails(thumbnailUrl, uniqueTag, channelUrl, extension){

  const containingFolder = `uploads/${channelUrl}`;

  const thumbnailDestination = `uploads/${channelUrl}/${uniqueTag}-custom.${extension}`;

  const thumbnail = await request.getAsync(thumbnailUrl, { encoding: 'binary' });

  await mkdirp.mkdirpAsync(containingFolder);

  // save the thumbnail locally

  await fs.writeFileAsync(thumbnailDestination, thumbnail.body, 'binary');

  const fileTypeData = await FileType.fromFile(thumbnailDestination);

  const realExtension = fileTypeData.ext;

  const mime = fileTypeData.mime;

  if(realExtension == 'webp'){

    const newDestination = `uploads/${channelUrl}/${uniqueTag}-custom.png`;

    // convert to png
    const result = await webp.dwebp(thumbnailDestination, newDestination, "-o");

    console.log(result);
    console.log('ITS A WEBP')

    extension = 'png'
  }

  // TODO: test : is this webp?

  // if so, have to convert that file to png via that libary
  // const result = webp.dwebp(originalFile, convertedFile, "-o");

  // then return the path of that file as this function

  // also pass that extension

  // return the extension

  console.log(`THUMBNAILS SAVED LOCALLY`);

  console.log(uniqueTag)

  return extension

};


const youTubeLink = '';

const channelUrl = 'anthony';

function last(array) {
  return array[array.length - 1];
}

// this is going to be a straight copy with no ability to add a custom title etc

async function downloadVideoForUser(channelUrl, youtubeLink){
  console.log(channelUrl, youtubeLink)

  try {

      let isBrighteonDownload = false;

      let options;
      if (isBrighteonDownload) {
        options = ['-f bestvideo'];
      } else {
        options = ['-j', '--flat-playlist', '--dump-single-json'];
      }

      let info = await youtubeDlInfoAsync(youtubeLink, options);

      info = info[0];

      delete info.formats;

      console.log(info);
      //
      // console.log(info.thumbnails);

      const videoData = info;

      const height = videoData.height;

      const width = videoData.width;

      const aspectRatio = height / width;

      const title = videoData.title;

      const durationInSeconds = videoData._duration_raw;

      const fileSize = videoData.size;

      // var result = yourstr.replace(/^(?:00:)?0?/, '');

      let formattedDuration = videoData._duration_hms;

      if(formattedDuration) formattedDuration = formattedDuration.replace(/^(?:00:)?0?/, '');



      // console.log(info);

      var lastThumbnail = last(info.thumbnails);


      const user = 'anthony';
      const downloadLocation = `/uploads/${user}`;

      const uploadingUser = await User.findOne({
        channelUrl
      });

      console.log(uploadingUser._id + ' here');

      const uniqueTag = randomstring.generate(7);

      const lastThumbnailUrl = lastThumbnail.url;

      var re = /(?:\.([^.]+))?$/;

      var extension = re.exec(lastThumbnailUrl)[1];


      console.log(aspectRatio, title, durationInSeconds, fileSize, formattedDuration)

      // instantiate upload
      // give it status and uploader and it will work
      let upload = new Upload({
        uploader: uploadingUser._id,
        title,
        description : info.description,
        fileType: 'video',
        fileExtension : '.mp4',
        uniqueTag,
        youTubeDLData: info,
        status: 'completed',
        rating: 'allAges',
        category: 'uncategorized',
        dimensions: {
          height,
          width,
          aspectRatio
        },
        formattedDuration,
        fileSize,
        durationInSeconds,


        // TODO: this is for dev purposes
        uploadServer: 'http://localhost:3000/uploads'
      });

      await upload.save();

      // // TODO: download thumbnail
      // // this comes back as an extension
      // const downloadResponse = await downloadAndSaveThumbnails(lastThumbnailUrl, uniqueTag, channelUrl, extension);
      //
      // console.log(downloadResponse + ' DOWNLOAD RESPONSE')
      //
      // upload.thumbnails.custom = `${uniqueTag}-custom.${downloadResponse}`;
      //
      // upload.processingCompletedAt = new Date();
      //
      // await upload.save();



      // "thumbnails" : {
      //   "custom" : "EnQPn7t-custom.jpg"
      // }


      const directory = `uploads/${uploadingUser.channelUrl}/${uniqueTag}.mp4`;

      let arguments = [];

      // set the url for ytdl
      arguments.push(youtubeLink);

      // verbose output
      arguments.push('-v');

      // arguments.push('-f', 'bestvideo+bestaudio/best');

      arguments.push('--add-metadata');

      arguments.push('--ffmpeg-location');

      arguments.push(ffmpegPath);

      arguments.push('--no-mtime');

      arguments.push('--ignore-errors');

      // select download as audio or video

      // download as mp4 if it's youtube (tired of reconverting .flv files)
      const isYouTubeDownload = youtubeLink.match('youtube');
      if(1 == 1){
        console.log('downloading from youtube');

        arguments.push('-f');

        arguments.push('bestvideo[height<730][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4][height<730]/best[ext=mp4]');
      }

      // arguments.push('best');

      const fileExtension = `%(ext)s`;

      const filePath = '.';

      // let saveToFolder = `${filePath}/%(title)s.${fileExtension}`;

      // save to videos directory
      arguments.push('-o', directory);

      console.log(arguments);

      // deleted for now since it requires ffmpeg
      // download as audio if needed
      // if(downloadAsAudio){
      //   console.log('Download as audio');
      //   arguments.push('-x');
      // }

      console.log(arguments);

      const ls = spawn(youtubeBinaryFilePath, arguments);

      ls.stdout.on('data', data => {

        console.log(`stdout: ${data}`);
      });

      ls.stderr.on('data', data => {

        console.log(`stderr: ${data}`);
      });

      ls.on('close', code => {

        console.log(`child process exited with code ${code}`);
      });


      // console.log(info.formats);
      // console.log('Download started')
      // console.log('filename: ' + info._filename)
      // console.log('size: ' + info.size)

      // duration
      // height

    // video.pipe(fs.createWriteStream('myvideo.mp4'))

  } catch (err){
    console.log(err);
    // console.log(err);
    //
    // console.log(err.stderr + ' stderr')
  }




}

function youtubeDlInfoAsync(url, options) {
  return new Promise(function(resolve, reject) {
    youtubedl.getInfo(url, options, function(err, data) {
      if (err !== null) reject(err);
      else resolve(data);
    });
  });
}


// downloadVideoForUser(channelUrl, youTubeLink);



// module.exports = downloadVideoForUser;

const youtubeLink = '';
downloadVideoForUser(channelUrl, youtubeLink)