var Q = require('q');
var request = require('requestretry');
var Build = module.exports = function (options) {
    this._auth = options.auth;
    this.url = options.url;
    this.consoleOutput = "";
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
        options.quiet = options.quiet || false;
        if (undefined === buildStart) {
            buildStart = new Date();
        }
        return Q.nfcall(request, {
            method: 'get',
            json: true,
            url: this.url + "api/json",
            auth: this._auth
        }).then(function (buildInfoResponse) {
            var buildInfoResponseBody = buildInfoResponse[0].body;
            if (!options.quiet) {
                process.stdout.clearLine();
            }
            if (!buildInfoResponseBody.building) {
                if (!options.quiet) {
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
            if (!options.quiet) {
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
        return Q.nfcall(request, {
            method: 'get',
            url: this.url + "logText/progressiveText",
            qs: {
                start: start
            },
            auth: this._auth,
        }).then(function (response) {
            if (200 !== response[0].statusCode) {
                if (retries > 10) {
                    throw response;
                }
                console.log("bad response from server, trying again...");
                return Q.delay(1000).then(this._fetchConsoleNotifications.bind(this, start, retries + 1));
            }
            this._gotConsoleOutputDeferred.notify(response[0].body);
            this.consoleOutput += response[0].body;
            start = parseInt(response[0].headers['x-text-size'], 10);
            if (!response[0].headers['x-more-data']) {
                this._gotConsoleOutputDeferred.resolve(this.consoleOutput);
                return;
            }
            return Q.delay(1000).then(this._fetchConsoleNotifications.bind(this, start));
        }.bind(this));
    }
};
