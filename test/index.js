#!/usr/bin/env node

var component = require('component');
var each = require('each-component');
var extend = require('extend');
var fs = require('fs');
var json = require('../package.json');
var map = require('map');
var pad = require('pad-component');
var path = require('path');
var program = require('commander');
var utils = component.utils;


/**
 * Program.
 */

program
  .option('-s, --styles', 'count the styles filesize')
  .option('-a, --all', 'include static files in the count')
  .version(json.version)
  .description(json.description)
  .parse(process.argv);


/**
 * Walk the packages.
 */

var file = path.resolve('component.json');
if (!fs.existsSync(file)) utils.fatal('missing component.json');
stat(file);


/**
 * Log the sizes of a component.json `file`'s local files and all of it's
 * dependencies.
 *
 * @param {String} file
 */

function stat (file) {
  var packages = sort(sizes(file));
  var nameLength = 0;
  var sizeLength = 0;

  each(packages, function (name, size) {
    size = kb(size);
    packages[name] = size;
    if (name.length > nameLength) nameLength = name.length;
    if (size.length > sizeLength) sizeLength = size.length;
  });

  function print (name) {
    log(name, nameLength, packages[name], sizeLength);
    delete packages[name];
  }

  console.log();
  print(name(file));
  console.log();
  each(packages, print);
  console.log();
}


/**
 * Sort a `packages` object by file size.
 *
 * @param {Object} packages
 * @return {Object}
 */

function sort (packages) {
  var ret = {};
  var arr = map(packages, function (key, val) {
    return {
      name: key,
      size: val
    };
  });

  arr.sort(function (a, b) {
    if (a.size > b.size) return -1;
    if (a.size < b.size) return 1;
    return 0;
  });

  each(arr, function (pkg) {
    ret[pkg.name] = pkg.size;
  });

  return ret;
}


/**
 * Convert a `size` in bytes to a kilobyte string.
 *
 * @param {Number} bytes
 * @return {String}
 */

function kb (bytes) {
  var num = Math.round(bytes / (1 << 10) * 100) / 100;
  if (/\.\d{1}$/.test(num)) num = num + '0';
  return num + ' kb';
}


/**
 * Get the name of a component.json `file`.
 *
 * @param {String} file
 */

function name (file) {
  var json = require(path.resolve(file));
  return json.repo || json.name;
}


/**
 * Log the size of a single component with a `name` and `size` in bytes. The
 * `nameLength` and `sizeLength` determine how much to pad the values by.
 *
 * @param {String} name
 * @param {Number} nameLength
 * @param {Number} size
 * @param {Number} sizeLength
 */

function log (name, nameLength, size, sizeLength) {
  name = pad.right(name + ' ' , nameLength + 2);
  size = pad.left(' ' + size, sizeLength + 1);
  utils.log('size', name + size);
}


/**
 * Pad a `string` with `char`s in `direction` until it reaches `length`.
 *
 * @param {String} string
 * @param {String} char
 * @param {String} direction
 * @param {Number} length
 */

function pad (string, char, direction, length) {
  for (var i = string.length; i < length; i++) {
    string = direction === 'left'
      ? char + string
      : string + char;
  }
  return string;
}


/**
 * Calculate the sizes of all of an component.json `file`'s dependencies.
 *
 * @param {String} file
 * @param {String} name (optional)
 * @param {String} parent (optional)
 * @return {Object}
 */

function sizes (file) {
  var json = require(path.resolve(file));
  var ret = {};
  var name = json.repo || json.name || 'local';
  ret[name] = size(file);

  var deps = dependencies(file);
  for (var key in deps) {
    ret[key] = size(deps[key]);
  }

  return ret;
}


/**
 * Given a component.json `file`, return the size in bytes of it's locals.
 *
 * @param {String} file
 * @return {Number}
 */

function size (file) {
  var files = locals(file);
  return files.reduce(function (bytes, file) {
    return bytes + fs.statSync(file).size;
  }, 0);
}


/**
 * Given a component.json `file`, return a dictionary of the component.json
 * files of all of its dependencies.
 *
 * @param {String} file
 * @return {Object}
 */

function dependencies (file) {
  var json = require(path.resolve(file));
  var deps = json.dependencies || {};
  var ret = {};

  for (var key in deps) {
    var slug = key.replace('/', '-');
    var dep = path.resolve('components', slug, 'component.json');
    ret[key] = dep;
    extend(ret, dependencies(dep));
  }

  return ret;
}


/**
 * Given a component.json `file` return the filenames of it's locals.
 *
 * @param {String} file
 * @return {Array}
 */

function locals (file) {
  var dir = path.dirname(file);
  var json = require(path.resolve(file));
  var sources = [];
  var files = [];

  if (program.styles || program.all) {
    sources.push('styles');
  }

  if (!program.styles || program.all) {
    sources.push('scripts', 'templates');
  }

  if (program.all) {
    sources.push('images', 'fonts', 'files');
  }

  sources.forEach(function (source) {
    if (json[source]) files = files.concat(json[source]);
  });

  return files.map(function (file) {
    return path.resolve(dir, file);
  });
}