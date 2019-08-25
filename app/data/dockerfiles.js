const path = require('path');
const appUtil = require('../util/AppUtils');
const pathConverter = require('../util/pathConverter.js');
const configData = require('./config.js');
const async = require('async');
const fs = require('fs');
const fsExtra= require('fs-extra');
const checker = require('../util/AppChecker.js');
const rimraf = require('rimraf');
const recursive  = require('recursive-readdir');



const dockerfileBaseContent = "FROM alpine:latest";

function createFiles(dfPath, content, cb) {
    async.eachSeries(content, (f, c) => {
      filePath = path.join(path.join(dfPath, f.id));
      if(f.type == 'dir') {
        c(null);
      } else {
        fsExtra.outputFile(filePath, f.content, c);
      }
    }, (err) => cb(err));
}

function getDockerfileBasePath(cb) {
  async.waterfall([
    (cb) => configData.getUserPath(cb),
    (up, cb) => cb(null, path.join(up, '.dockerfiles'))
  ], (err, dockerPath) => cb(null, dockerPath));
}

function isDockerfileDir(f, cb) {
  cb(null, true);
}

function createDockerfile (name, callback) {
  let dataPath = "";
  async.waterfall([
    (cb) => checker.checkAlphabetic(name, cb),
    (cb) => getDockerfileBasePath(cb),
    // Create file
    (dp, cb) =>  {
      dataPath = dp;
      fs.mkdir(path.join(dataPath, name), cb);
    },
    (cb) => fs.writeFile(path.join(dataPath, name, 'Dockerfile'), dockerfileBaseContent, cb)
  ], (err, results) => callback(err, results));
}

function getDockerfiles (callback) {
  let dataPath;
  async.waterfall([
    (cb) => getDockerfileBasePath(cb),
    (dp, cb) => {
      dataPath = dp;
      fs.readdir(dp, cb);
      // Get only dirs containing a Dockerfile
    }, (dockerfiles, cb) => {
      let res = [];
      async.eachSeries(dockerfiles, (f, c) => {
        fs.exists(path.join(dataPath, f, 'Dockerfile'), (exists, err) => {
          if (err) {
            c(err);
          } else {
              if (exists) {
              res.push(f);
            }
            c(null);
          }
        })}, (err2) => cb(err2, res))
      }
    ], (err, results) => callback(err, results));
}

function editDockerfile(name, content, callback) {
  let dockerfilesPath;
  let dfPath;
  let tempPath;
  async.waterfall([
    (cb) => configData.getUserPath(cb),
    // Init variables
    (up, cb) =>  {
      dockerfilesPath= path.join(up, '.dockerfiles');
      dfPath = path.join(dockerfilesPath, name);
      tempPath = path.join(dockerfilesPath, '.tmpdir');
      cb(null)
    },
    // Copy temp
    (cb) => appUtil.renameDir(dfPath, tempPath, cb),
    // Create empty dir
    (cb) => fs.mkdir(dfPath, cb),
    (cb) => createFiles(dfPath, content, cb),
    // Delete temp path
    (cb) => rimraf(tempPath, cb)
      // const mm = jsonConverter(
    ], (err) => {
      if (err) {
        appUtil.renameDir(tempPath, dfPath, (e) => {
          callback(err);
        });
      } else {
        callback(null);
      }
    })
}

function removeDockerfile(name, callback) {
  async.waterfall([
    (cb) => checker.checkAlphabetic(name, cb),
    (cb) => configData.getUserPath(cb),
    (up, cb) => {
      const toDelete = path.join(up, '.dockerfiles', name);
      rimraf(toDelete, cb)
    }
  ], (err) => callback(err));
}

function getDockerfile(name, callback) {
  let dockerfilesPath = "";
  async.waterfall([
    (cb) => checker.checkAlphabetic(name, cb),
    (cb) => configData.getUserPath(cb),
    (up, cb) => {
      dockerfilesPath = path.join(up, '.dockerfiles', name);
      recursive(dockerfilesPath, cb)
  },
  (allFiles, cb) => {
    let arrayRet = [];
    // Read files and generate structure
    async.eachSeries(allFiles, (f, c) => {
      fs.readFile(f, (err, data) => {
        if (err) {
          c(err);
        } else {
          // Append to ret structure
          arrayRet.push({file: f, content: data.toString()});
          c(null);
        }
      })
    }, (err) => cb(err, arrayRet))
  },
  (structure, cb) => {
    const treeModel = pathConverter.getTree(structure, dockerfilesPath);
    cb(null, treeModel);
  }], (err, data) => callback(err, data))
}

exports.createDockerfile = createDockerfile;
exports.getDockerfiles = getDockerfiles;
exports.editDockerfile = editDockerfile
exports.removeDockerfile = removeDockerfile
exports.getDockerfile = getDockerfile
