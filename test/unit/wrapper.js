'use strict';

const { expect } = require('chai');

const https = require('https');
const wrapper = require('../../lib/wrapper');

describe('wrapper', function() {
  describe("when initialization succeeded", function() {
    beforeEach(async function() {
      this.resource = this.sinon.stub({
        create: () => {},
        update: () => {},
        delete: () => {},
      });
      this.handler = wrapper(() => this.resource);

      await this.handler(
        // event
        {
          RequestType: 'Update',
          PhysicalResourceId: 'physical-resource-id',
          StackId: 'stack-id',
          RequestId: 'request-id',
          LogicalResourceId: 'logical-resource-id',
          ResponseURL: 'https://cfn-resource-url/path',
        },
        // context
        {
          logStreamName: '/aws/log/stream',
          getRemainingTimeInMillis: () => 10000, // this leaves 7s
        },
      );
    });

    it("sends a success response", function() {
      expect(https.request)
        .to.have.been.calledOnce.calledWith({
          method: "PUT", protocol: "https:", hostname: "cfn-resource-url", path: "/path",
          headers: this.sinon.match.any,
        });
      expect(this.request.write).to.have.been.calledOnce;
      expect(this.jsonRequest())
        .to.deep.equal({
          Status: 'SUCCESS',
          PhysicalResourceId: 'physical-resource-id', // original physical resource id
          StackId: 'stack-id',
          RequestId: 'request-id',
          LogicalResourceId: 'logical-resource-id',
          // no data
        });
    });
  });

  describe("when initialization fails", function() {
    beforeEach(async function() {
      this.error = new Error('initialization-error');
      this.handler = wrapper(() => { throw this.error; });

      try {
        await this.handler(
          // event
          {
            RequestType: 'Update',
            PhysicalResourceId: 'physical-resource-id',
            StackId: 'stack-id',
            RequestId: 'request-id',
            LogicalResourceId: 'logical-resource-id',
            ResponseURL: 'https://cfn-resource-url/path',
          },
          // context
          {
            logStreamName: '/aws/log/stream',
            getRemainingTimeInMillis: () => 10000, // this leaves 7s
          },
        );
      } catch (thrown) {
        this.thrown = thrown;
      }
    });

    it("sends a failure response", function() {
      expect(https.request)
        .to.have.been.calledOnce.calledWith({
          method: "PUT", protocol: "https:", hostname: "cfn-resource-url", path: "/path",
          headers: this.sinon.match.any,
        });
      expect(this.request.write).to.have.been.calledOnce;
      expect(this.jsonRequest())
        .to.include({
          Status: 'FAILED',
          PhysicalResourceId: 'physical-resource-id',
          StackId: 'stack-id',
          RequestId: 'request-id',
          LogicalResourceId: 'logical-resource-id',
        });
      expect(this.jsonRequest().Reason).to.match(/initialization-error/);
    });

    it("returns a failed promise", function() {
      expect(this.thrown).to.equal(this.error);
    });
  });
});
