'use strict';

// Configuring debug if DEBUG env variable is set.
const { configure, LOG_DEBUG } = require('cfn-custom-resource');
if (process.env.DEBUG) configure({ logLevel: LOG_DEBUG });

module.exports = require('./lib/wrapper');
