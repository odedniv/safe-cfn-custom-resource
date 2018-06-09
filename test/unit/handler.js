'use strict';

const { expect } = require('chai');

const https = require('https');
const Handler = require('../../lib/handler');

describe('Handler', function() {
  describe("when initialization succeeded", function() {
    beforeEach(function() {
      this.handler = new Handler(
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
        // resource
        this.sinon.stub({
          create: () => {},
          update: () => {},
          delete: () => {},
        }),
        // initErr
        undefined,
      );
    });

    describe("when resource succeeds", function() {
      describe("without physical id and data", function() {
        beforeEach(async function() {
          this.handler.resource.update.returns({});
          await this.handler.promise();
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

      describe("with physical id and data", function() {
        beforeEach(async function() {
          this.handler.resource.update.returns({
            id: 'new-physical-resource-id',
            data: { key: 'value' },
          });
          await this.handler.promise();
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
              PhysicalResourceId: 'new-physical-resource-id',
              StackId: 'stack-id',
              RequestId: 'request-id',
              LogicalResourceId: 'logical-resource-id',
              Data: { key: 'value' },
            });
        });
      });
    });

    describe("when resource fails", function() {
      beforeEach(async function() {
        this.error = new Error('resource-error');
        this.handler.resource.update.throws(this.error);
        try {
          await this.handler.promise();
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
        expect(this.jsonRequest().Reason).to.match(/resource-error/);
      });

      it("returns a failed promise", function() {
        expect(this.thrown).to.equal(this.error);
      });
    });

    describe("timeout", function() {
      describe("when resource doens't time out", function() {
        beforeEach(async function() {
          this.handler.resource.update.callsFake(() => {
            return new Promise(resolve => {
              setTimeout(() => { resolve({}); }, 6900);
              // can't tick entire amount as both timeouts will evaluate, creating a race between success and failure
              this.sinon.clock.tick(6950);
              // ticking in the next digest cycle
              setTimeout(() => this.sinon.clock.tick(3000));
            });
          });
          await this.handler.promise();
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
              PhysicalResourceId: 'physical-resource-id',
              StackId: 'stack-id',
              RequestId: 'request-id',
              LogicalResourceId: 'logical-resource-id',
            });
        });
      });

      describe("when resource times out", function() {
        beforeEach(async function() {
          this.handler.resource.update.callsFake(() => {
            return new Promise(resolve => {
              setTimeout(() => { resolve({}); }, 7100);
              // can't tick entire amount as both timeouts will evaluate, creating a race between success and failure
              this.sinon.clock.tick(7050);
              // ticking in the next digest cycle
              setTimeout(() => this.sinon.clock.tick(3000));
            });
          });
          try {
            await this.handler.promise();
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
          expect(this.jsonRequest().Reason).to.match(/Function timed out \(3 seconds prior to actual timeout\)/);
        });

        it("returns a failed promise", function() {
          expect(this.thrown).to.match(/Function timed out \(3 seconds prior to actual timeout\)/);
        });
      });
    });
  });

  describe("when initialization failed", function() {
    beforeEach(async function() {
      this.error = new Error('initialization-error');
      this.handler = new Handler(
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
        // resource
        this.sinon.stub({
          create: () => {},
          update: () => {},
          delete: () => {},
        }),
        // initErr
        this.error,
      );

      this.handler.resource.update.returns({});
      try {
        await this.handler.promise();
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

    it("doesn't invoke resource", function() {
      expect(this.handler.resource.update)
        .to.not.have.been.called;
    });
  });
});
