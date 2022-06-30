(function(){
    'use strict';

    var healthy = true;
    var messages = [];
    var storeRunning,
        apiRunning,
        celeryRunning, 
        dbrunning,
        redisrunning, 
        nginxrunning,
        edgecastRunning,
        sparkpostRunning,
        cloudflareRunning;
    var affectedSystem;
    var firstPartyAffected = false;
    var thirdPartyAffected = false;

    function _populateDetail(selector, status) {
        $(selector).find('img').attr('src', 
            status === true ? 'images/check.png' : 
            status === 'warn' ? 'images/hastywarning.png' :
            status === false ? 'images/hastyx.png' : ''
        );
    }

    function _httpHealthCheck(url) {
        return $.get(url).then(function(data, status, xhr) {
            return { data: data, status: status, xhr: xhr };
        }).fail(function(xhr) {
            return { data: {}, status: null, xhr: xhr };
        });
    }

    function storeCheck() {
        return _httpHealthCheck('https://store.typenetwork.com/').then(function(result) {
            storeRunning = result.status !== null && result.xhr.status === 200;
            if(!storeRunning) {
                affectedSystem = 'Store Server';
                firstPartyAffected = true;
            }
        });
    }

    function cloudflareCheck() {
        return _httpHealthCheck('https://yh6f0r4529hb.statuspage.io/api/v2/status.json').then(function(result){
            var data = result.data;
            if(result.status !== null && result.xhr.status === 200 && data.status) {
                if(data.status.indicator === 'none') {
                    cloudflareRunning = true;
                } else if(data.status.indicator === 'minor') {
                    cloudflareRunning = 'warn';
                } else {
                    cloudflareRunning = false;
                }
            } else {
                cloudflareRunning = false;
            }

            if(cloudflareRunning !== true) {
                affectedSystem = 'CloudFlare CDN';
                thirdPartyAffected = true;
            }

            _populateDetail('#status_cloudflare_detail', cloudflareRunning);
        });
    }

    function edgecastCheck() {
        return _httpHealthCheck('https://api.status.io/1.0/status/5736344c90417cda1a000f3f').then(function(result) {
            if(result.status !== null && result.xhr.status === 200) {
                // ensure we always seek; god forbid they change the order of this thing on us
                var httpSmall = result.data.result.status.filter(function(status) {
                    return status.name === 'HTTP Small';
                })[0];
                if(!httpSmall)
                {   
                    edgecastRunning = false;
                }
                else
                {
                    switch(httpSmall.status_code){
                        case 100:
                        case 200: 
                            edgecastRunning = true;
                            break;
                        case 300: 
                        case 400:
                            edgecastRunning = 'warn';
                            break;
                        default: 
                            edgecastRunning = false;
                    }
                }
            } else {
                edgecastRunning = false;
            }

            if(edgecastRunning !== true) {
                affectedSystem = 'EdgeCast CDN';
                thirdPartyAffected = true;
            }

            _populateDetail('#status_edgecast_detail', edgecastRunning);
        });
    }

    function apiCheck() {
        return _httpHealthCheck('https://api.typenetwork.com/api/1/health?format=json').then(function(result) {
            var data = result.data;
            if(result.status !== null && result.xhr.status === 200) {
                apiRunning = true;
                celeryRunning = data.celery === 'running' && data.celerybeat === 'running';
                dbrunning = data.database === 'running';
                redisrunning = data.redis === 'running';
                nginxrunning = data.nginx === 'running';

                if(!celeryRunning) { 
                    affectedSystem = 'Celery System'; 
                    firstPartyAffected = true; 
                }
                if(!dbrunning) { 
                    affectedSystem = 'Database Server'; 
                    firstPartyAffected = true; 
                }
                if(!redisrunning) { 
                    affectedSystem = 'Redis Server'; 
                    firstPartyAffected = true; 
                }
                if(!nginxrunning) { 
                    affectedSystem = 'Web Server'; 
                    firstPartyAffected = true; 
                }
            } else {
                apiRunning = false;
                celeryRunning = false;
                dbrunning = false;
                redisrunning = false;
                nginxrunning = false;

                affectedSystem = 'API Server';
                firstPartyAffected = true; 
            }

            _populateDetail('#status_api_detail', apiRunning);
            _populateDetail('#status_celery_detail', celeryRunning);
            _populateDetail('#status_redis_detail', redisrunning);
            _populateDetail('#status_nginx_detail', nginxrunning);
        });
    }

    function sparkpostCheck() {
        //https://ua.statuspage.io/ua?page_code=7ky1q6zd3fyp&organization_code=0y9qf7hln9fv&paid=true                  
        return _httpHealthCheck('https://7ky1q6zd3fyp.statuspage.io/api/v2/status.json').then(function(result){
            var data = result.data;
            if(result.status !== null && result.xhr.status === 200 && data.status) {
                if(data.status.indicator === 'none') {
                    sparkpostRunning = true;
                } else if(data.status.indicator === 'minor') {
                    sparkpostRunning = 'warn';
                } else {
                    sparkpostRunning = false;
                }
            } else {
                sparkpostRunning = false;
            }

            if(sparkpostRunning !== true) {
                affectedSystem = 'Sparkpost Mailer';
                thirdPartyAffected = true;
            }

            _populateDetail('#status_sparkpost_detail', sparkpostRunning);
        });
    }

    function setStatus(selector, value) {
        $(selector).text(value);
    }

    function getComposite() {
        var args = Array.prototype.slice.call(arguments);
        return args.reduce( function(status, arg) {
            if(arg === 'warn') {
                if(status != 'down') {
                    // return 'warn'; // mask out "warnings" for now, these count as "good"
                    return 'good';
                }
            } else if( arg === false ) {
                return 'down';
            }
            return status;
        }, 'good');
    }

    function statusCheck() {

        return $.when(
            storeCheck(),
            edgecastCheck(),
            cloudflareCheck(),
            apiCheck(),
            sparkpostCheck()
        ).done(function() {
            // now we build the composites ... 
            var webFontsStatus = getComposite(
                edgecastRunning, apiRunning, redisrunning
            );

            var orderStatus = getComposite(
                cloudflareRunning, apiRunning, storeRunning, dbrunning, redisrunning, nginxrunning
            );

            var emailStatus = getComposite(
                apiRunning, celeryRunning, sparkpostRunning
            );

            var finalStatus = 'good';
            [ ['#webfonts-status', webFontsStatus], ['#orders-status', orderStatus], ['#email-status', emailStatus] ].forEach(function(tuple) {
                var selector = tuple[0];
                var status = tuple[1];
                if(status === 'good') {
                    $(selector).find('img').attr('src', 'images/check.png');
                } else if( status === 'warn') {
                    $(selector).find('img').attr('src', 'images/hastywarning.png');
                    if(finalStatus != 'down') {
                        finalStatus = 'warn';
                    }
                } else {
                    $(selector).find('img').attr('src', 'images/hastyx.png');
                    finalStatus = 'down';
                }
            });

            if(finalStatus === 'good') {
                $('.contact.status_good_state').css('display', '');
            } else {
                $('#status_affected_system').text(
                    firstPartyAffected ? 'our server' : 'one of our third-party providers'
                );
                if(!firstPartyAffected) {
                    $('#status_aware').css('display', 'none');
                }
                $('.contact.status_error_state').css('display', '');
            }
        });
    }
      

    $(function() {
        // initialize status
        statusCheck().then(function() {
            // update in 10s intervals.
            // setInterval(statusCheck, 10000);
        });
    });
})();
