//colton
'use strict';
var express = require('express');
var router = express.Router();
require('dotenv').config();
var request = require('request');
var accesstoken = process.env.accesstoken;
/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'Express' });
});

function submitOrder(side, qty, symbol) {
    var orderObject = {
        "orderType": "MARKET",
        "session": "NORMAL",
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "orderLegCollection": [
            {
                "instruction": side,
                "quantity": qty,
                "instrument": {
                    "symbol": symbol,
                    "assetType": "EQUITY"
                }
            }
        ]
    }
    //Get main account id
    var account_req = {
        url: 'https://api.tdameritrade.com/v1/accounts',
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer ' + accesstoken
        }
    }
    request(account_req, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = JSON.parse(body);
            console.log(body);
            var accountId = body[0]['securitiesAccount']['accountId'];
            //Place Order
            var placeorder_req = {
                url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accesstoken,
                    'content-type': 'application/json',
                    'connection': 'Keep-Alive'
                },
                body: orderObject,
                json: true
            };
            request(placeorder_req, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                } else {
                    resetAccessToken(function () {
                        submitOrder(side, qty, symbol);
                    });
                }
            });
        } else {
            resetAccessToken(function () {
                submitOrder(side, qty, symbol);
            });
        }
    });
}

//Colton Alert
router.post('/coltonalert', function (req, res, next) {
    console.log(req.body);
    submitOrder(req.body.side.toUpperCase(), req.body.quantity, req.body.symbol.toUpperCase());
    res.status(200).end() // Responding is important
});


function resetAccessToken(done) {
    try {
        var refreshtoken_req = {
            url: 'https://api.tdameritrade.com/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'grant_type': 'refresh_token',
                'refresh_token': process.env.refreshtoken,
                'access_type': '',
                'client_id': process.env.CLIENT_ID
            }
        };

        request(refreshtoken_req, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Successfully reset access token.');
                // get the TDA response
                var authReply = JSON.parse(body);
                accesstoken = authReply.access_token;
                done();
            } else {
                console.log('Could not reset access token.');
                console.log(body);
                done()
            }
        });

    } catch (err) {
        console.log(err);
    }

}
resetAccessToken(function () {});
module.exports = router;
