'use strict';

const https = require('https');
const { PassThrough } = require('stream');

require('mocha-sinon');
require('chai')
  .use(require('sinon-chai'));

beforeEach(function() {
  this.sinon.useFakeTimers();
});

/*
 * Stub all HTTPS requests
 */

beforeEach(function() {
  this.request = new PassThrough();
  this.sinon.spy(this.request, 'write');
  this.response = new PassThrough();
  this.response.end();

  this.sinon.stub(https, 'request')
    .callsArgWith(1, this.response)
    .returns(this.request);

  this.jsonRequest = () => JSON.parse(this.request.write.getCall(0).args[0]);
});
