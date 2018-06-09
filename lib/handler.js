'use strict';

const { CREATE, UPDATE, DELETE, sendSuccess, sendFailure } = require('cfn-custom-resource');

/*
 * A class to handle the handler's logic, holding on to the data relevant to it.
 */
class Handler {
  constructor(event, context, resource, initErr) {
    this.event = event;
    this.context = context;
    this.resource = resource;
    this.initErr = initErr;
    this.responseSent = false;
  }

  /*
   * Does the actual handler logic, returns a promise to be returned to AWS Lambda.
   */
  async promise() {
    try {
      if (this.initErr) throw this.initErr;
      await Promise.race([
        this.handleTimeout(),
        this.handleResource(),
      ]);
    } catch (err) {
      await this.sendFailure({ reason: err, id: err && err.id });
      throw err;
    }
  }

  /*
   * Ensures CloudFormation gets a response at least 3 seconds before the function times out.
   */
  handleTimeout() {
    return new Promise((resolve, reject) => {
      if (process.env.DEBUG) {
        console.log(`Timing out in: ~${this.context.getRemainingTimeInMillis() - 3000}ms`);
      }
      setTimeout(
        () => reject(new Error("Function timed out (3 seconds prior to actual timeout)")),
        this.context.getRemainingTimeInMillis() - 3000
      );
    });
  }

  /*
   * Calls the resource's functions, depending on the event's RequestType.
   */
  async handleResource() {
    let resource = await this.resource; // initializer to return a promise
    let method = {
      [CREATE]: resource.create,
      [UPDATE]: resource.update,
      [DELETE]: resource.delete,
    }[this.event.RequestType];

    if (!method) throw new Error(`Invalid RequestType received: ${this.event.RequestType}`);
    await this.sendSuccess(
      await method(this.event, this.context) || {}
    );
  }

  /*
   * Wrapper around cfn-custom-resource's sendSuccess, with the Handler's data.
   */
  async sendSuccess({ id, data }) {
    if (this.responseSent) return;
    this.responseSent = true;
    await sendSuccess(id || this.event.PhysicalResourceId, data, this.event);
  }

  /*
   * Wrapper around cfn-custom-resource's sendFailure, with the Handler's data.
   */
  async sendFailure({ reason, id }) {
    if (this.responseSent) return;
    this.responseSent = true;
    await sendFailure(reason, this.event, undefined, this.context, id);
  }
}

module.exports = Handler;
