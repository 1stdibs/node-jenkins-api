var Q = require('q');
var request = require('requestretry');
var Build = module.exports = function (options) {
    this._auth = options.auth;
    this.url = options.url;
    this.consoleOutput = "";
    this.quiet = options.quiet || false;
};
Build.prototype = {
    abort: function () {
        request({
            method: 'post',
            url: this.url + "stop",
            auth: this._auth
        });
    },
    built: function (options, buildStart) {
        options = options || {};
        if (undefined === buildStart) {
            buildStart = new Date();
        }
        return request({
            method: 'get',
            json: true,
            url: this.url + "api/json",
            auth: this._auth
        }).then(function (buildInfoResponse) {
            var buildInfoResponseBody = buildInfoResponse.body;
            if (!this.quiet) {
                process.stdout.clearLine();
            }
            if (!buildInfoResponseBody.building) {
                if (!this.quiet) {
                    console.log("build result: " + buildInfoResponseBody.result);
                }
                if ("FAILURE" === buildInfoResponseBody.result) {
                    throw buildInfoResponseBody;
                }
                return buildInfoResponseBody;
            }
            if (buildInfoResponseBody.aborted) {
                console.log("build was aborted");
                throw buildInfoResponseBody;
            }
            if (!this.quiet) {
                process.stdout.write("Build time elapsed : " + Math.floor((new Date() - buildStart) / 1000) + " seconds\r");
            }
            return Q.delay(1000).then(this.built.bind(this, options, buildStart));
        }.bind(this));
    },
    startConsole : function () {
        this._gotConsoleOutputDeferred = Q.defer();
        this.gotConsoleOutput = this._gotConsoleOutputDeferred;// TODO: figure out why I can use this._gotConsoleOutputDeferred.promise
        this._fetchConsoleNotifications(0);
    },
    _fetchConsoleNotifications: function (start, retries) {
        if (undefined === retries) {
            retries = 0;
        }
        if (undefined === start) {
            start = 0;
        }
        return request({
            method: 'get',
            url: this.url + "logText/progressiveText",
            qs: {
                start: start
            },
            auth: this._auth,
        }).then(function (response) {
            if (200 !== response.statusCode) {
                if (retries > 10) {
                    throw response;
                }
                console.log("bad response from server, trying again...");
                return Q.delay(1000).then(this._fetchConsoleNotifications.bind(this, start, retries + 1));
            }
            this._gotConsoleOutputDeferred.notify(response.body);
            this.consoleOutput += response.body;
            start = parseInt(response.headers['x-text-size'], 10);
            if (!response.headers['x-more-data']) {
                this._gotConsoleOutputDeferred.resolve(this.consoleOutput);
                return;
            }
            return Q.delay(1000).then(this._fetchConsoleNotifications.bind(this, start));
        }.bind(this));
    }
};
