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

function submitOrder(side, qty, symbol, alert) {
    /*
     * Entry Order
     */
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
            console.log(JSON.stringify(orderObject));
            request(placeorder_req, function (error, response, body) {
                console.log(body);
                if (response.statusCode >= 400) {
                    resetAccessToken(function () {
                        submitOrder(side, qty, symbol);
                    });
                } else {
                    /*
                     * Exit Order
                     */

                    /*
                     * Profit Target and Stop Loss OCO / Bracket Order
                     */
                    if (alert.profitTarget && alert.stopLoss) {
                        var orderObject = {
                            "orderStrategyType": "OCO",
                            "childOrderStrategies": [
                                {
                                    "orderType": "LIMIT",
                                    "session": "NORMAL",
                                    "duration": "DAY",
                                    "price": '"' + alert.close * (1 + (parseFloat(alert.profitTarget) / 100)) + '"',
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
                                },
                                {
                                    "orderType": "LIMIT",
                                    "session": "NORMAL",
                                    "duration": "DAY",
                                    "price": '"' + alert.close * (1 - (parseFloat(alert.stopLoss) / 100)) + '"',
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
                            ]
                        }
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
                        console.log(JSON.stringify(orderObject));
                        request(placeorder_req, function (error, response, body) {
                            console.log(body);
                        });
                    }
                    /*
                    * Just Profit Target
                    */
                    else if (alert.profitTarget && alert.stopLoss) {
                        var orderObject = {
                            "orderType": "LIMIT",
                            "session": "NORMAL",
                            "duration": "DAY",
                            "price": '"' + alert.close * (1 + (parseFloat(alert.profitTarget) / 100)) + '"',
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
                        console.log(JSON.stringify(orderObject));
                        request(placeorder_req, function (error, response, body) {
                            console.log(body);
                        });
                    }
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
    submitOrder(req.body.side.toUpperCase(), req.body.quantity, req.body.symbol.toUpperCase(), req.body);
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
resetAccessToken(function () { });
module.exports = router;
