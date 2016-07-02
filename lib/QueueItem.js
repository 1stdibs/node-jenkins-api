var readline = require('readline');
var request = require('requestretry');
var Q = require('q');
var QueueItem = module.exports = function (options) {
    this._auth = options.auth;
    this._url = options.url;
};
QueueItem.prototype = {
    notInQueue: function () {
        return request({
            method: 'get',
            json: true,
            url: this._url + "api/json",
            auth: this._auth
        }).then(function (queueDataResponse) {
            var queueDataResponseBody = queueDataResponse.body;
            if (queueDataResponseBody.cancelled) {
                throw new Error('build cancelled');
            }
            if (queueDataResponseBody.executable) {
                return queueDataResponseBody;
            }
            readline.clearLine();
            process.stdout.write("Waiting : " + queueDataResponseBody.why + "\r");
            return Q.delay(1000).then(this.notInQueue.bind(this));
        }.bind(this));
    }
};