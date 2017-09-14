'use strict';

function _httpHealthCheck(url) {
    return $.get(url).then(function(data, status, xhr) {
        return { data: data, status: status, xhr: xhr };
    }).fail(function(xhr) {
        return { data: {}, status: null, xhr };
    });
}

function storeCheck() {
    return _httpHealthCheck('https://store.typenetwork.com/');
}

function cloudflareCheck() {
    return _httpHealthCheck('https://yh6f0r4529hb.statuspage.io/api/v2/status.json');
}

function edgecastCheck() {
    return _httpHealthCheck('https://api.status.io/1.0/status/5736344c90417cda1a000f3f');
}

function apiCheck() {
    return _httpHealthCheck('https://api.typenetwork.com/api/1/health-check');
}

function sparkpostCheck() {
    //https://ua.statuspage.io/ua?page_code=7ky1q6zd3fyp&organization_code=0y9qf7hln9fv&paid=true                  
    return _httpHealthCheck('https://7ky1q6zd3fyp.statuspage.io/api/v2/status.json');
}

function setStatus(selector, value) {
    $(selector).text(value);
}

function statusCheck() {
    let healthy = true;
    let messages = [];

    // check web fonts status.
    return storeCheck().then(function(result) {
        setStatus('#store-status', result.xhr.status === 200 ? 'Y' : 'N');
    }).then(edgecastCheck).then(function(result) {
        console.log('edgecastCheck', result);
        let httpSmall = result.data.result.status[6];
        let indicator = 'N';
        switch(httpSmall.status_code){
            case 200: 
                indicator = 'Y'; 
                break;
            case 300: 
                indicator = 'P'; 
            default: 
                messages.push('Web fonts: Edgecast  ' + httpSmall.name + ' ' + httpSmall.status)
        }
        setStatus('#webfonts-status', indicator);
    }).then(apiCheck).then(function(result) {
        console.log('apiCheck', result);
    }).then(sparkpostCheck).then(function(result) {
        console.log('sparkpostCheck', result);
    }).then(function() {
        if (messages.length == 0) {
            $('#status-description').text("Everything is running smoothly here, but if  you are still experiencing issues, feel free to consult the Type Network support pages or contact us directly.");
        }
        else {
            $('#status-description').html(messages.join('<br />'));
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